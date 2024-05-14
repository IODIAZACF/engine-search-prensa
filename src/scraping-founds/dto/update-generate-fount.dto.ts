import { PartialType } from '@nestjs/mapped-types';
import { CreateGenerateFountDto } from './create-generate-fount.dto';

export class UpdateGenerateFountDto extends PartialType(CreateGenerateFountDto) {}
