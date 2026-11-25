// Sidebar icons per screen (Phosphor). Kept apart from ./screens.ts so the registry imports no component.
import type { Icon } from '@phosphor-icons/react';
import { Book, CalendarBlank, ChartBar, Gear, House, Handshake, MapTrifold, Package, PlugsConnected, Scales, Tray, Truck, Warning, ClipboardText } from '@phosphor-icons/react/dist/ssr';
import type { ScreenId } from './screens';

export const SCREEN_ICONS: Partial<Record<ScreenId, Icon>> = {
  home: House, calendar: CalendarBlank, map: MapTrifold, requests: Tray, shipments: Truck, shipment: Package, rfq: Scales,
  incidents: Warning, partners: Handshake, partner: Handshake, customs: ClipboardText, reports: ChartBar, admin: Gear,
  connectors: PlugsConnected, journal: Book,
};
