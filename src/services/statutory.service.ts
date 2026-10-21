import { mockDelay } from "@/lib/async";
import { indianStates, useOperations } from "@/store/operations-store";
import type { StatePayrollConfiguration, StatutoryConfiguration } from "@/types";

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getStatutoryConfig(): Promise<StatutoryConfiguration> {
  return mockDelay(useOperations.getState().config);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateStatutoryConfig(patch: Partial<StatutoryConfiguration>): Promise<StatutoryConfiguration> {
  useOperations.getState().updateConfig(patch);
  return mockDelay(useOperations.getState().config, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getStatePayrollConfig(): Promise<StatePayrollConfiguration[]> {
  return mockDelay(useOperations.getState().config.states);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateStatePayrollConfig(state: string, professionalTax: number): Promise<void> {
  useOperations.getState().updateStatePT(state, professionalTax);
  return mockDelay(undefined, 500);
}

export { indianStates };
