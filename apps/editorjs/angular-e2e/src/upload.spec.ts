import { uploadCases } from '../upload/cases.js';
import { uploadDisplayCases } from '../persistence/display-cases.js';
uploadDisplayCases(false);
uploadCases('/?upload');
