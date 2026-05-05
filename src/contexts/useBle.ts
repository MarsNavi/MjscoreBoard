import { useContext } from 'react';
import { BleContext } from './BleContext';

export function useBle() {
  const context = useContext(BleContext);
  if (context === undefined) {
    throw new Error('useBle must be used within a BleProvider');
  }
  return context;
}
