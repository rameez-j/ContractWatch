'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { toast } from 'react-hot-toast';
import { X, Edit3 } from 'lucide-react';

interface EditWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wallet: {
    id: string;
    address: string;
    name?: string;
  } | null;
}

export function EditWalletModal({ isOpen, onClose, onSuccess, wallet }: EditWalletModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set the current name when the modal opens
  useEffect(() => {
    if (wallet && isOpen) {
      setName(wallet.name || '');
    }
  }, [wallet, isOpen]);

  const updateWallet = trpc.addWallet.useMutation({
    onSuccess: () => {
      toast.success('Wallet name updated successfully!');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Failed to update wallet: ${error.message}`);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet) return;

    setIsSubmitting(true);
    // Use the same addWallet mutation - it will update the name due to ON CONFLICT
    updateWallet.mutate({ 
      address: wallet.address, 
      name: name.trim() || undefined 
    });
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  if (!isOpen || !wallet) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Edit3 className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold">Edit Wallet Name</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="wallet-address" className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Address
            </label>
            <input
              type="text"
              id="wallet-address"
              value={wallet.address}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="wallet-name" className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Name (Optional)
            </label>
            <input
              type="text"
              id="wallet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Main Wallet, DEX Deployer, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to remove the custom name
            </p>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {isSubmitting ? 'Updating...' : 'Update Name'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 