import type { FirestoreConfig } from './firestore'

/**
 * The Firebase project that stores the encrypted sync copies. These values are not secret
 * (Firebase web config is meant to be public); the security rules protect the data, and
 * the data itself is encrypted on the device. Empty = cloud sync isn't set up yet.
 */
export const FIRESTORE: FirestoreConfig = {
  projectId: 'endstep-d6bc3',
  apiKey: 'AIzaSyC3wnIEPjS_V_TO7U6ww1hIRyuPO9M6FQA',
}

export const syncAvailable = () => FIRESTORE.projectId !== '' && FIRESTORE.apiKey !== ''
