'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit3, Eye, Trash2 } from 'lucide-react';

interface WalletActionsDropdownProps {
  wallet: any;
  onEdit: (wallet: any) => void;
  onView: (address: string) => void;
  onRemove: (address: string) => void;
  isRemoving?: boolean;
}

export function WalletActionsDropdown({ 
  wallet, 
  onEdit, 
  onView, 
  onRemove, 
  isRemoving = false 
}: WalletActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        disabled={isRemoving}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
          <button
            onClick={() => handleAction(() => onView(wallet.address))}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </button>
          
          <button
            onClick={() => handleAction(() => onEdit(wallet))}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Name
          </button>
          
          <hr className="my-1" />
          
          <button
            onClick={() => handleAction(() => onRemove(wallet.address))}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
            disabled={isRemoving}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Wallet
          </button>
        </div>
      )}
    </div>
  );
} 