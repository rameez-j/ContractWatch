'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { toast } from 'react-hot-toast';

interface AddWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddWalletModal({ isOpen, onClose, onSuccess }: AddWalletModalProps) {
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addWallet = trpc.addWallet.useMutation({
    onSuccess: () => {
      toast.success('Wallet added successfully!');
      setAddress('');
      setName('');
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to add wallet: ${error.message}`);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim()) {
      toast.error('Please enter a wallet address');
      return;
    }

    if (address.length !== 42 || !address.startsWith('0x')) {
      toast.error('Please enter a valid Ethereum address');
      return;
    }

    setIsSubmitting(true);
    addWallet.mutate({ address: address.trim(), name: name.trim() || undefined });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Wallet</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Name (Optional)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Main Wallet, DEX Deployer, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Address *
            </label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
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
              {isSubmitting ? 'Adding...' : 'Add Wallet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 