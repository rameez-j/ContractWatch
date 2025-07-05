'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { X, Wallet } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AddWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddWalletModal({ isOpen, onClose, onSuccess }: AddWalletModalProps) {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addWalletMutation = trpc.addWallet.useMutation({
    onSuccess: () => {
      toast.success('Wallet added successfully!');
      setAddress('');
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to add wallet: ${error.message}`);
    },
    onSettled: () => {
      setIsLoading(false);
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

    setIsLoading(true);
    addWalletMutation.mutate({ address: address.trim() });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Wallet className="h-6 w-6 text-primary-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Add Wallet</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Wallet Address
              </label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="input"
                disabled={isLoading}
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter a valid Ethereum wallet address (42 characters, starting with 0x)
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Wallet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 