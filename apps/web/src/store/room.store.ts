import { create } from 'zustand';
import type { Room, RoomParticipant, ChatMessage } from '@vyro/types';

interface RoomState {
  room: Room | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  isConnected: boolean;

  setRoom: (room: Room) => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  addParticipant: (participant: RoomParticipant) => void;
  removeParticipant: (userId: string) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  participants: [],
  messages: [],
  isConnected: false,

  setRoom: (room) => set({ room }),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [
        ...state.participants.filter((p) => p.userId !== participant.userId),
        participant,
      ],
    })),

  removeParticipant: (userId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.userId !== userId),
    })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message].slice(-200), // Keep last 200 messages
    })),

  setMessages: (messages) => set({ messages }),

  setConnected: (connected) => set({ isConnected: connected }),

  reset: () =>
    set({ room: null, participants: [], messages: [], isConnected: false }),
}));
