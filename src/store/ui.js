import { create } from 'zustand'
export const useUI = create(set => ({
  activeTab: 'datos', setTab: (t) => set({ activeTab: t }), dirty: false, setDirty: (v) => set({ dirty: v })
}))