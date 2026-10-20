import express from 'express';
import {
  getAllFirebaseTasks,
  getFirebaseTaskById,
  createFirebaseTask,
  updateFirebaseTask,
  patchFirebaseTask,
  deleteFirebaseTask
} from '../controller/FirebaseController.js';

const router = express.Router();

// Routes for Firebase task operations (/api/firebase/tasks)
router.route('/')
  .get(getAllFirebaseTasks)
  .post(createFirebaseTask);

router.route('/:id')
  .get(getFirebaseTaskById)
  .put(updateFirebaseTask)
  .patch(patchFirebaseTask)
  .delete(deleteFirebaseTask);

export default router;
