'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { X, Wallet, ExternalLink, Copy, Calendar, Network, Hash } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface WalletDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function WalletDetailsModal({ isOpen, onClose, walletAddress }: WalletDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  const { data: deployments, isLoading, refetch } = trpc.listDeployments.useQuery(
    { wallet: walletAddress, limit: 50 },
    { enabled: isOpen && !!walletAddress }
  );

  const { data: stats } = trpc.getStats.useQuery(
    { wallet: walletAddress, days: 30 },
    { enabled: isOpen && !!walletAddress }
  );

  // Get wallet details including name
  const { data: walletDetails } = trpc.getWallets.useQuery(
    {},
    { enabled: isOpen && !!walletAddress }
  );

  // Find the specific wallet in the list
  const currentWallet = walletDetails?.wallets?.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());

  // Set up real-time updates via WebSocket
  useEffect(() => {
    if (!isOpen || !walletAddress) return;

    const ws = new WebSocket('ws://localhost:3000/live');
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.wallet.toLowerCase() === walletAddress.toLowerCase()) {
          toast.success(`New deployment detected: ${data.contract.slice(0, 8)}...`);
          refetch();
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [isOpen, walletAddress, refetch]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getEtherscanUrl = (txHash: string, network: string) => {
    const baseUrls: Record<string, string> = {
      'eth_mainnet': 'https://etherscan.io',
      'sepolia': 'https://sepolia.etherscan.io',
      'polygon': 'https://polygonscan.com',
      'arbitrum': 'https://arbiscan.io',
    };
    
    const baseUrl = baseUrls[network] || 'https://etherscan.io';
    return `${baseUrl}/tx/${txHash}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h2 className="text-xl font-bold text-gray-900">
                  {currentWallet?.name || 'Wallet Details'}
                </h2>
                <p className="text-sm text-gray-500 font-mono">
                  {walletAddress}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-primary-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Hash className="h-5 w-5 text-primary-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-primary-900">Total Deployments</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {deployments?.deployments?.length || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-green-900">Last 30 Days</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats?.stats?.reduce((sum, stat) => sum + parseInt(stat.count), 0) || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Network className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Networks</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {new Set(deployments?.deployments?.map(d => d.network)).size || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deployments List */}
          <div className="border border-gray-200 rounded-lg">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h4 className="text-lg font-medium text-gray-900">Recent Deployments</h4>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : deployments?.deployments?.length === 0 ? (
                <div className="text-center py-8">
                  <Hash className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No deployments found for this wallet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {deployments?.deployments?.map((deployment) => (
                    <div key={deployment.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <Hash className="h-4 w-4 text-primary-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {formatAddress(deployment.contract_address)}
                                </p>
                                <button
                                  onClick={() => copyToClipboard(deployment.contract_address)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <a
                                  href={getEtherscanUrl(deployment.tx_hash, deployment.network)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              <div className="flex items-center space-x-4 mt-1">
                                <p className="text-xs text-gray-500">
                                  {format(new Date(deployment.ts), 'MMM dd, yyyy HH:mm')}
                                </p>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  deployment.network === 'eth_mainnet' ? 'bg-blue-100 text-blue-800' :
                                  deployment.network === 'sepolia' ? 'bg-yellow-100 text-yellow-800' :
                                  deployment.network === 'polygon' ? 'bg-purple-100 text-purple-800' :
                                  deployment.network === 'arbitrum' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {deployment.network}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Gas Used</p>
                          <p className="text-sm font-medium text-gray-900">
                            {parseInt(deployment.gas_used).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 