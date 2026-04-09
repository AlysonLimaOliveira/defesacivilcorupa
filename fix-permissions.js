import fs from 'fs';
import path from 'path';

const gradlewPath = path.resolve(process.cwd(), 'android', 'gradlew');
if (fs.existsSync(gradlewPath)) {
  fs.chmodSync(gradlewPath, '755');
  console.log('Permissions fixed for gradlew');
} else {
  console.error('gradlew not found at', gradlewPath);
}
