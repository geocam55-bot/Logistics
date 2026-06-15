import { DeliveryStatus, DeliveryRecord, Tenant, Branch, Truck, User } from './types';

// Central lists are empty initially for custom live partner commissioning
export const TENANTS: Tenant[] = [];

export const BRANCHES: Branch[] = [];

export const TRUCKS: Truck[] = [];

export const PRESET_PENDING_EPICOR_ORDERS: any[] = [];

export const INITIAL_DELIVERIES: DeliveryRecord[] = [];

export const INITIAL_USERS: User[] = [];

// --- tenant 2: Bay of Fundy Transport (BOF) Seed Data ---
export const BRANCHES_BOF: Branch[] = [];

export const TRUCKS_BOF: Truck[] = [];

export const INITIAL_USERS_BOF: User[] = [];

export const INITIAL_DELIVERIES_BOF: DeliveryRecord[] = [];

// --- tenant 3: Cabot Trail Cargo (CTC) Seed Data ---
export const BRANCHES_CTC: Branch[] = [];

export const TRUCKS_CTC: Truck[] = [];

export const INITIAL_USERS_CTC: User[] = [];

export const INITIAL_DELIVERIES_CTC: DeliveryRecord[] = [];
