// MongoDB connection strings to try in order
const mongoUris = [
  // Try Atlas SRV first
  process.env.MONGODB_URI || 'mongodb+srv://cybereliastk_db_user:3bBKj4DtLRh7DNd8@cea.rz1xdmd.mongodb.net/',
  // Fallback to full replica set format
  'mongodb://cybereliastk_db_user:3bBKj4DtLRh7DNd8@ac-okkbkq6-shard-00-00.rz1xdmd.mongodb.net:27017,ac-okkbkq6-shard-00-01.rz1xdmd.mongodb.net:27017,ac-okkbkq6-shard-00-02.rz1xdmd.mongodb.net:27017/?replicaSet=atlas-ljgzbm-shard-0&ssl=true&authSource=admin',
  // Final fallback to localhost
  'mongodb://localhost:27017/agreement-trust',
];

let currentUriIndex = 0;

export const getMongoUri = () => mongoUris[currentUriIndex];

export const setNextMongoUri = () => {
  currentUriIndex++;
  if (currentUriIndex >= mongoUris.length) {
    console.warn('All MongoDB connection attempts failed');
    return false;
  }
  console.log(`Trying MongoDB URI: ${mongoUris[currentUriIndex].substring(0, 50)}...`);
  return true;
};

export default {
  port: process.env.PORT || 3001,
  mongoUri: getMongoUri(),
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8080',
};
