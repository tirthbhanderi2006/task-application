import {
  getAllFirebaseTasksService,
  getFirebaseTaskByIdService,
  createFirebaseTaskService,
  updateFirebaseTaskService,
  patchFirebaseTaskService,
  deleteFirebaseTaskService
} from '../services/firebaseTaskService.js';

// HATEOAS: Build hypermedia links for a single Firebase task
export const buildFirebaseTaskLinks = (req, taskId) => {
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    self:       { href: `${base}/api/firebase/tasks/${taskId}`, method: 'GET' },
    update:     { href: `${base}/api/firebase/tasks/${taskId}`, method: 'PUT' },
    patch:      { href: `${base}/api/firebase/tasks/${taskId}`, method: 'PATCH' },
    delete:     { href: `${base}/api/firebase/tasks/${taskId}`, method: 'DELETE' },
    collection: { href: `${base}/api/firebase/tasks`,           method: 'GET' }
  };
};

// Helper to clean and append links to Firebase task object
export const cleanFirebaseTask = (req, taskData) => {
  if (!taskData) return null;
  const taskObj = { ...taskData };
  const idVal = taskObj.id || taskObj._id;

  if (req && idVal) {
    taskObj._links = buildFirebaseTaskLinks(req, idVal);
  }
  return taskObj;
};

// GET /api/firebase/tasks - Get all tasks from Firebase Firestore
export const getAllFirebaseTasks = async (req, res, next) => {
  try {
    const tasks = await getAllFirebaseTasksService();
    const cleanedTasks = tasks.map(t => cleanFirebaseTask(req, t));

    if (req.query?.links === 'true' || req.query?.hateoas === 'true') {
      const base = `${req.protocol}://${req.get('host')}`;
      return res.status(200).json({
        count: tasks.length,
        source: 'Firebase Firestore',
        _links: {
          self:   { href: `${base}/api/firebase/tasks`, method: 'GET' },
          create: { href: `${base}/api/firebase/tasks`, method: 'POST' }
        },
        data: cleanedTasks
      });
    }

    res.status(200).json(cleanedTasks);
  } catch (err) {
    next(err);
  }
};

// GET /api/firebase/tasks/:id - Get a single task from Firebase Firestore by ID
export const getFirebaseTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await getFirebaseTaskByIdService(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Firebase Task with ID '${id}' not found`
      });
    }

    res.status(200).json(cleanFirebaseTask(req, task));
  } catch (err) {
    next(err);
  }
};

// POST /api/firebase/tasks - Create a new task in Firebase Firestore
export const createFirebaseTask = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Task title is required'
      });
    }

    const newTask = await createFirebaseTaskService(req.body);

    const base = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Location', `${base}/api/firebase/tasks/${newTask.id}`);
    res.status(201).json(cleanFirebaseTask(req, newTask));
  } catch (err) {
    next(err);
  }
};

// PUT /api/firebase/tasks/:id - Full update of a task in Firebase Firestore
export const updateFirebaseTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Task title is required for full update'
      });
    }

    const updatedTask = await updateFirebaseTaskService(id, req.body);
    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Firebase Task with ID '${id}' not found`
      });
    }

    res.status(200).json(cleanFirebaseTask(req, updatedTask));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/firebase/tasks/:id - Partial update of a task in Firebase Firestore
export const patchFirebaseTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedTask = await patchFirebaseTaskService(id, req.body);

    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Firebase Task with ID '${id}' not found`
      });
    }

    res.status(200).json(cleanFirebaseTask(req, updatedTask));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/firebase/tasks/:id - Delete a task from Firebase Firestore
export const deleteFirebaseTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedTask = await deleteFirebaseTaskService(id);

    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Firebase Task with ID '${id}' not found`
      });
    }

    res.status(200).json({
      message: 'Firebase task deleted successfully',
      task: cleanFirebaseTask(req, deletedTask)
    });
  } catch (err) {
    next(err);
  }
};
