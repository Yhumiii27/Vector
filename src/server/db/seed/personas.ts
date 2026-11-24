// "View as" personas of the demo mode: one fictitious person per Vector role (no real person; e-mail domain demo.example).
import type { RoleKey } from '@/config/roles';

export const DEMO_PERSONAS: readonly { role: RoleKey; name: string; email: string }[] = [
  { role: 'manager', name: 'Élise Garnier', email: 'elise.garnier@demo.example' },
  { role: 'coordinator', name: 'Hugo Leclerc', email: 'hugo.leclerc@demo.example' },
  { role: 'compliance', name: 'Nadia Brun', email: 'nadia.brun@demo.example' },
  { role: 'finance', name: 'Marc Olivier', email: 'marc.olivier@demo.example' },
  { role: 'packing', name: 'Léo Martin', email: 'leo.martin@demo.example' },
  { role: 'requester', name: 'Sarah Roux', email: 'sarah.roux@demo.example' },
  { role: 'reader', name: 'Anne Duval', email: 'anne.duval@demo.example' },
  { role: 'admin', name: 'Paul Vasseur', email: 'paul.vasseur@demo.example' },
];
