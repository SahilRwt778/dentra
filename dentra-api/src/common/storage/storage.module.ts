import { Global, Module } from '@nestjs/common';
import { SupabaseFileStorage } from './supabase-file-storage';

@Global()
@Module({ providers: [SupabaseFileStorage], exports: [SupabaseFileStorage] })
export class StorageModule {}
