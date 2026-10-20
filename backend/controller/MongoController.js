import mongoose from 'mongoose';
import {
  getAllTasksService,
  getTaskByIdService,
  createTaskService,
  updateTaskService,
  patchTaskService,
  deleteTaskService
} from '../services/taskService.js';

const isFirebase = () => (process.env.DB_TYPE || 'mongo').toLowerCase() === 'firebase';

// HATEOAS: Build hypermedia links for a single task
export const buildTaskLinks = (req, taskId) => {
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    self:       { href: `${base}/api/tasks/${taskId}`, method: 'GET' },
    update:     { href: `${base}/api/tasks/${taskId}`, method: 'PUT' },
    patch:      { href: `${base}/api/tasks/${taskId}`, method: 'PATCH' },
    delete:     { href: `${base}/api/tasks/${taskId}`, method: 'DELETE' },
    collection: { href: `${base}/api/tasks`,           method: 'GET' }
  };
};

// Helper to format task object with _id, id, and _links
export const cleanTask = (req, taskDoc) => {
  if (!taskDoc) return null;
  const taskObj = typeof taskDoc.toJSON === 'function' ? taskDoc.toJSON() : { ...taskDoc };
  delete taskObj.__v;

  const idVal = taskObj.id || (taskObj._id ? taskObj._id.toString() : '');
  taskObj._id = idVal;
  taskObj.id = idVal;

  if (req) {
    taskObj._links = buildTaskLinks(req, idVal);
  }
  return taskObj;
};

// GET /api/tasks - Retrieve all tasks
export const getAllTasks = async (req, res, next) => {
  try {
    const tasks = await getAllTasksService();
    const cleanedTasks = tasks.map(t => cleanTask(req, t));

    if (req.query?.links === 'true' || req.query?.hateoas === 'true') {
      const base = `${req.protocol}://${req.get('host')}`;
      return res.status(200).json({
        count: tasks.length,
        activeDatabase: process.env.DB_TYPE || 'mongo',
        _links: {
          self:   { href: `${base}/api/tasks`, method: 'GET' },
          create: { href: `${base}/api/tasks`, method: 'POST' }
        },
        data: cleanedTasks
      });
    }

    res.status(200).json(cleanedTasks);
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/:id - Retrieve a single task by ID
export const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isFirebase() && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }

    const task = await getTaskByIdService(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }
    res.status(200).json(cleanTask(req, task));
  } catch (err) {
    next(err);
  }
};

// POST /api/tasks - Create a new task
export const createTask = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Task title is required'
      });
    }

    const newTask = await createTaskService(req.body);
    const idVal = newTask.id || newTask._id;

    const base = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Location', `${base}/api/tasks/${idVal}`);
    res.status(201).json(cleanTask(req, newTask));
  } catch (err) {
    next(err);
  }
};

// PUT /api/tasks/:id - Full update of an existing task
export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isFirebase() && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }

    const updatedTask = await updateTaskService(id, req.body);
    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }

    res.status(200).json(cleanTask(req, updatedTask));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tasks/:id - Partial update of a task
export const patchTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isFirebase() && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }

    const updatedTask = await patchTaskService(id, req.body);
    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }

    res.status(200).json(cleanTask(req, updatedTask));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tasks/:id - Delete a task
export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isFirebase() && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }

    const deletedTask = await deleteTaskService(id);
    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Task with ID '${id}' not found`
      });
    }

    res.status(200).json({
      message: 'Task deleted successfully',
      task: cleanTask(req, deletedTask)
    });
  } catch (err) {
    next(err);
  }
};
