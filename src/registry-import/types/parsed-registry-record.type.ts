import { RegistryRecordField } from '../constants/registry-import.constants';

export type ParsedRegistryRecord = {
  rowNumber: number;
} & Partial<Record<RegistryRecordField, string>>;
