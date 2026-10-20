import Task from '../models/Task.js';
import {
  getAllFirebaseTasksService,
  getFirebaseTaskByIdService,
  createFirebaseTaskService,
  updateFirebaseTaskService,
  patchFirebaseTaskService,
  deleteFirebaseTaskService
} from './firebaseTaskService.js';

// Helper to check current database provider from process.env.DB_TYPE
const isFirebase = () => (process.env.DB_TYPE || 'mongo').toLowerCase() === 'firebase';

// Unified Service: Fetch all tasks
export const getAllTasksService = async () => {
  if (isFirebase()) {
    return await getAllFirebaseTasksService();
  }
  return await Task.find().sort({ createdAt: -1 });
};

// Unified Service: Fetch a single task by ID
export const getTaskByIdService = async (id) => {
  if (isFirebase()) {
    return await getFirebaseTaskByIdService(id);
  }
  return await Task.findById(id);
};

// Unified Service: Create a new task
export const createTaskService = async (taskData) => {
  if (isFirebase()) {
    return await createFirebaseTaskService(taskData);
  }
  const { title, description, completed, priority } = taskData;
  return await Task.create({
    title,
    description,
    completed,
    priority
  });
};

// Unified Service: Full update of an existing task
export const updateTaskService = async (id, updateData) => {
  if (isFirebase()) {
    return await updateFirebaseTaskService(id, updateData);
  }
  const { title, description, completed, priority } = updateData;
  return await Task.findByIdAndUpdate(
    id,
    { title, description, completed, priority },
    { new: true, runValidators: true }
  );
};

// Unified Service: Partial update of a task
export const patchTaskService = async (id, patchData) => {
  if (isFirebase()) {
    return await patchFirebaseTaskService(id, patchData);
  }
  return await Task.findByIdAndUpdate(
    id,
    patchData,
    { new: true, runValidators: true }
  );
};

// Unified Service: Delete a task by ID
export const deleteTaskService = async (id) => {
  if (isFirebase()) {
    return await deleteFirebaseTaskService(id);
  }
  return await Task.findByIdAndDelete(id);
};
