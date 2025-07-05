'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Plus, Wallet, Activity, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AddWalletModal } from '@/components/AddWalletModal';
import { format } from 'date-fns';

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const { data: wallets, isLoading, refetch } = trpc.getWallets.useQuery({});
  const removeWalletMutation = trpc.removeWallet.useMutation({
    onSuccess: () => {
      toast.success('Wallet removed successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to remove wallet: ${error.message}`);
    },
  });

  const handleRemoveWallet = (address: string) => {
    if (confirm('Are you sure you want to stop monitoring this wallet?')) {
      removeWalletMutation.mutate({ address });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor smart contract deployments from your tracked wallets
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Wallet
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <Wallet className="h-8 w-8 text-primary-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Tracked Wallets</p>
              <p className="text-2xl font-bold text-gray-900">
                {wallets?.wallets?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Deployments</p>
              <p className="text-2xl font-bold text-gray-900">
                {wallets?.wallets?.reduce((sum, w) => sum + (w.deployment_count || 0), 0) || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 font-semibold">🔍</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Status</p>
              <p className="text-2xl font-bold text-green-600">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wallets List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Tracked Wallets</h2>
        </div>
        
        {wallets?.wallets?.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No wallets tracked</h3>
            <p className="text-gray-500 mb-4">
              Start monitoring smart contract deployments by adding a wallet address.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Wallet
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {wallets?.wallets?.map((wallet) => (
              <div key={wallet.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {wallet.address}
                        </p>
                        <p className="text-sm text-gray-500">
                          Added {format(new Date(wallet.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">
                        {wallet.deployment_count || 0}
                      </p>
                      <p className="text-xs text-gray-500">Deployments</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedWallet(wallet.address)}
                        className="btn-secondary text-sm"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleRemoveWallet(wallet.address)}
                        className="btn-danger text-sm"
                        disabled={removeWalletMutation.isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Wallet Modal */}
      <AddWalletModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsAddModalOpen(false);
        }}
      />
    </div>
  );
} 