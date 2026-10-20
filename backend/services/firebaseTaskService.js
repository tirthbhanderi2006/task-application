import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase.config.js';

const COLLECTION_NAME = 'tasks';

// Service: Fetch all tasks from Firestore
export const getAllFirebaseTasksService = async () => {
  const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
  const tasks = [];
  querySnapshot.forEach((docSnap) => {
    tasks.push({
      id: docSnap.id,
      _id: docSnap.id,
      ...docSnap.data()
    });
  });
  return tasks;
};

// Service: Fetch a single task by Firestore Document ID
export const getFirebaseTaskByIdService = async (id) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }
  return {
    id: docSnap.id,
    _id: docSnap.id,
    ...docSnap.data()
  };
};

// Service: Create a new task document in Firestore
export const createFirebaseTaskService = async (taskData) => {
  const { title, description = '', completed = false, priority = 'medium' } = taskData;
  const payload = {
    title,
    description,
    completed: Boolean(completed),
    priority,
    createdAt: new Date().toISOString()
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
  return {
    id: docRef.id,
    _id: docRef.id,
    ...payload
  };
};

// Service: Full update of a task document in Firestore
export const updateFirebaseTaskService = async (id, updateData) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }

  const { title, description = '', completed = false, priority = 'medium' } = updateData;
  const payload = {
    title,
    description,
    completed: Boolean(completed),
    priority,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(docRef, payload);

  const updatedSnap = await getDoc(docRef);
  return {
    id: updatedSnap.id,
    _id: updatedSnap.id,
    ...updatedSnap.data()
  };
};

// Service: Partial update of a task document in Firestore
export const patchFirebaseTaskService = async (id, patchData) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }

  const payload = {
    ...patchData,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(docRef, payload);

  const updatedSnap = await getDoc(docRef);
  return {
    id: updatedSnap.id,
    _id: updatedSnap.id,
    ...updatedSnap.data()
  };
};

// Service: Delete a task document from Firestore
export const deleteFirebaseTaskService = async (id) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }

  const taskData = {
    id: docSnap.id,
    _id: docSnap.id,
    ...docSnap.data()
  };

  await deleteDoc(docRef);
  return taskData;
};
