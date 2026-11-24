// The connectors of Vector and their state (page /admin/connectors). Pure list: what each reads or writes, how, and whether
// it is simulated (docs/spec/05). EN source strings.
export interface ConnectorDef {
  tool: string;
  object: string;
  nature: 'read' | 'write';
  how: string;
  state: 'simulated' | 'waiting' | 'live';
  request: string;
}

export const CONNECTORS: readonly ConnectorDef[] = [
  { tool: 'Clavis', object: 'clavis.pub_acces', nature: 'read', how: 'Roles Vector.* at sign-in and on every request', state: 'waiting', request: 'DM-2, DCL-1' },
  { tool: 'Matrix', object: 'matrix.pub_sites, matrix.pub_filiales', nature: 'read', how: 'Sites of departure and arrival', state: 'waiting', request: 'DM-2' },
  { tool: 'Keystone', object: 'keystone.pub_projets, pub_articles, pub_nomenclatures', nature: 'read', how: 'Projects, articles, HS codes, packing check', state: 'waiting', request: 'DM-2' },
  { tool: 'Keystone', object: 'vector.pub_expeditions, vector.pub_colis', nature: 'read', how: 'Keystone and Arche read Vector (transition R-158)', state: 'waiting', request: 'DM-3, DK-1, DA-1' },
  { tool: 'Codex', object: 'POST /api/documents', nature: 'write', how: 'Deposit of generated documents (outbox)', state: 'simulated', request: 'DC-1' },
  { tool: 'Codex', object: 'codex.pub_documents', nature: 'read', how: 'State of the documents cited', state: 'waiting', request: 'DM-2' },
  { tool: 'Vigie', object: 'API of Vigie (to be provided)', nature: 'write', how: 'Dangerous goods notices and transport incidents (outbox)', state: 'simulated', request: 'DV-1' },
  { tool: 'Tracking', object: 'Tracking API (provider to be chosen)', nature: 'read', how: 'Milestones and ETA reported automatically', state: 'simulated', request: 'D-14' },
  { tool: 'Mail', object: 'Graph Mail.Send or SMTP', nature: 'write', how: 'Requests for quotation to the forwarders (outbox)', state: 'simulated', request: 'D-15' },
  { tool: 'Sage', object: 'Extraction of carrier invoices (VECTOR_SAGE_DIR)', nature: 'read', how: 'Invoiced costs and reconciliation', state: 'waiting', request: 'D-19' },
];
