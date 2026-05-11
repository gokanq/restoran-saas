import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
const { diskStorage } = require('multer');
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'menu');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
  @Post('image')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: any, _file: any, callback: any) => {
          mkdirSync(UPLOAD_DIR, { recursive: true });
          callback(null, UPLOAD_DIR);
        },
        filename: (_req: any, file: any, callback: any) => {
          const extension = extname(file.originalname || '').toLowerCase();
          const safeExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension)
            ? extension
            : '.jpg';

          callback(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: (_req: any, file: any, callback: any) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          callback(
            new BadRequestException('Sadece JPG, PNG veya WEBP görsel yüklenebilir.'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Geçerli bir görsel dosyası gönderin.');
    }

    if (!req.user?.restaurantId) {
      throw new BadRequestException('Restaurant bilgisi bulunamadı.');
    }

    return {
      url: `/api/uploads/menu/${file.filename}`,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
