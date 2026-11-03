// The same profile.json at the repo root feeds both this page and the chat assistant.
import data from '../../../profile.json';

export type Profile = typeof data;
export const profile: Profile = data;
