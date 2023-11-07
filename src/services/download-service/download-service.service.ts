import { Injectable } from '@nestjs/common';
import { createReadStream, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class DownloadServiceService {

  constructor() {
    // create connection to your file storage
  }

  imageBuffer() {
    return readFileSync(join(process.cwd(), 'notiz.png'));
  }

  imageStream() {
    return createReadStream(join(process.cwd(), 'notiz.png'));
  }

  fileBuffer() {
    return readFileSync(join(process.cwd(), 'package.json'));
  }

  fileStream() {
    return createReadStream(join(process.cwd(), 'package.json'));
  }

}
