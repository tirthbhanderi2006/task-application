import mongoose from 'mongoose';

const connectDB = async () => {
  const dbType = (process.env.DB_TYPE || 'mongo').toLowerCase();
  
  if (dbType === 'firebase') {
    console.log('[Database Engine] Active Database Provider: Firebase Firestore');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskdb');
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB Connection Error] ${error.message}`);
  }
};

export default connectDB;
