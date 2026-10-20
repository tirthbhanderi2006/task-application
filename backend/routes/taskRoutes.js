import express from 'express';
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  patchTask,
  deleteTask
} from '../controller/MongoController.js';

const router = express.Router();

// Routes for /api/tasks and /tasks
router.route('/')
  .get(getAllTasks)
  .post(createTask);

router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .patch(patchTask)
  .delete(deleteTask);

export default router;
