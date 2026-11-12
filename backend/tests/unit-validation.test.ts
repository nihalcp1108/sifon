import { describe, it, expect } from 'vitest';
import {
  productQuerySchema,
  productOptionsQuerySchema,
} from '../src/modules/products/product.validation.js';
import {
  areaQuerySchema,
  areaOptionsQuerySchema,
  createAreaSchema,
  updateAreaSchema,
  sectionFilterQueryParam,
} from '../src/modules/areas/area.validation.js';
import {
  objectIdRegex,
  objectIdSchema,
  objectIdParamSchema,
  optionalObjectIdQueryParam,
} from '../src/utils/query-validation.js';
import { changeEmailSchema, changePasswordSchema } from '../src/modules/auth/auth.validation.js';
import { isPlaceholderUri, normalizeMongoUri } from '../src/config/env.js';

describe('Unit Validation Tests', () => {
  it('Product Query Schema handles numeric pagination, bounds, boolean activeOnly/isActive, and empty filters', () => {
    const parsedDefault = productQuerySchema.parse({});
    expect(parsedDefault.limit).toBe(20);
    expect(parsedDefault.page).toBe(1);

    // String 'true' converts to boolean true
    const parsed200 = productQuerySchema.parse({ limit: '200', activeOnly: 'true' });
    expect(parsed200.limit).toBe(200);
    expect(parsed200.activeOnly).toBe(true);

    // Boolean true passed directly converts to boolean true
    const parsedBool = productQuerySchema.parse({ activeOnly: true, isActive: true, limit: 500 });
    expect(parsedBool.limit).toBe(500);
    expect(parsedBool.activeOnly).toBe(true);
    expect(parsedBool.isActive).toBe(true);

    // Boolean false and string 'false' both parse to boolean false (NEVER converted to true)
    const parsedFalseStr = productQuerySchema.parse({ activeOnly: 'false' });
    expect(parsedFalseStr.activeOnly).toBe(false);

    const parsedFalseBool = productQuerySchema.parse({ activeOnly: false });
    expect(parsedFalseBool.activeOnly).toBe(false);

    // Empty strings, 'undefined', 'null', 'all' are safely omitted as undefined
    const parsedEmpty = productQuerySchema.parse({
      activeOnly: '',
      isActive: 'undefined',
      search: '   ',
      limit: '',
      page: '',
    });
    expect(parsedEmpty.activeOnly).toBeUndefined();
    expect(parsedEmpty.isActive).toBeUndefined();
    expect(parsedEmpty.search).toBeUndefined();
    expect(parsedEmpty.limit).toBe(20);
    expect(parsedEmpty.page).toBe(1);

    // Limit up to 1000 allowed
    const parsed1000 = productQuerySchema.parse({ limit: '1000' });
    expect(parsed1000.limit).toBe(1000);

    // Invalid limits and pages throw clean validation errors
    expect(() => productQuerySchema.parse({ limit: '1001' })).toThrow(/maximum allowed value/);
    expect(() => productQuerySchema.parse({ limit: '0' })).toThrow(/positive integer/);
    expect(() => productQuerySchema.parse({ limit: '-10' })).toThrow(/positive integer/);
    expect(() => productQuerySchema.parse({ limit: 'abc' })).toThrow(/Must be a valid integer/);
    expect(() => productQuerySchema.parse({ page: '0' })).toThrow(/positive integer/);

    // Invalid boolean strings throw clean errors
    expect(() => productQuerySchema.parse({ activeOnly: 'notabool' })).toThrow(/Must be a boolean value/);
  });

  it('Area Query Schema handles numeric pagination, bounds, boolean activeOnly/isActive, and sectionId filtering', () => {
    const parsed100 = areaQuerySchema.parse({ limit: '100', activeOnly: 'true' });
    expect(parsed100.limit).toBe(100);
    expect(parsed100.activeOnly).toBe(true);

    const parsed200 = areaQuerySchema.parse({ limit: '200', activeOnly: true });
    expect(parsed200.limit).toBe(200);
    expect(parsed200.activeOnly).toBe(true);

    const parsedFalse = areaQuerySchema.parse({ activeOnly: 'false' });
    expect(parsedFalse.activeOnly).toBe(false);

    // Section filtering: hex ObjectId, unassigned, all/empty
    const parsedHex = areaQuerySchema.parse({ sectionId: '507f1f77bcf86cd799439011' });
    expect(parsedHex.sectionId).toBe('507f1f77bcf86cd799439011');

    const parsedUnassigned = areaQuerySchema.parse({ sectionId: 'unassigned' });
    expect(parsedUnassigned.sectionId).toBe('unassigned');

    const parsedUnassignedUpper = areaQuerySchema.parse({ sectionId: '  UNASSIGNED  ' });
    expect(parsedUnassignedUpper.sectionId).toBe('unassigned');

    const parsedAll = areaQuerySchema.parse({ sectionId: 'all' });
    expect(parsedAll.sectionId).toBeUndefined();

    const parsedEmpty = areaQuerySchema.parse({ sectionId: '   ' });
    expect(parsedEmpty.sectionId).toBeUndefined();

    expect(() => areaQuerySchema.parse({ sectionId: 'invalid-id' })).toThrow(/Invalid Section ID format/);
    expect(() => areaQuerySchema.parse({ limit: '1001' })).toThrow(/maximum allowed value/);
    expect(() => areaQuerySchema.parse({ limit: '0' })).toThrow(/positive integer/);
  });

  it('Create and Update Area Schemas enforce required names, trimmed strings, and valid sectionIds', () => {
    const validCreate = createAreaSchema.parse({
      name: '  Main Storage Bay  ',
      sectionId: '507f1f77bcf86cd799439011',
      description: 'Primary storage area',
    });
    expect(validCreate.name).toBe('Main Storage Bay');
    expect(validCreate.sectionId).toBe('507f1f77bcf86cd799439011');
    expect(validCreate.description).toBe('Primary storage area');

    // Name cannot be empty or whitespace only
    expect(() =>
      createAreaSchema.parse({
        name: '   ',
        sectionId: '507f1f77bcf86cd799439011',
      })
    ).toThrow(/Area name cannot be empty/);

    // Section ID required on create
    expect(() =>
      createAreaSchema.parse({
        name: 'Bay 1',
        sectionId: '',
      })
    ).toThrow(/Invalid Section ID format/);

    // Update Area schema allows partial fields
    const validUpdate = updateAreaSchema.parse({
      name: '  Updated Bay Name  ',
      isActive: false,
    });
    expect(validUpdate.name).toBe('Updated Bay Name');
    expect(validUpdate.isActive).toBe(false);
  });

  it('Dedicated productOptionsQuerySchema and areaOptionsQuerySchema handle dropdown requirements', () => {
    const pOpts = productOptionsQuerySchema.parse({
      search: '  Widget-A  ',
      limit: '150',
      activeOnly: 'true',
      selectedId: '60d5ec49f1b2c8b1f8c8b456',
    });
    expect(pOpts.search).toBe('Widget-A');
    expect(pOpts.limit).toBe(150);
    expect(pOpts.activeOnly).toBe(true);
    expect(pOpts.selectedId).toBe('60d5ec49f1b2c8b1f8c8b456');

    const aOpts = areaOptionsQuerySchema.parse({
      limit: '100',
      activeOnly: true,
      selectedId: '60d5ec49f1b2c8b1f8c8b789',
    });
    expect(aOpts.limit).toBe(100);
    expect(aOpts.activeOnly).toBe(true);
    expect(aOpts.selectedId).toBe('60d5ec49f1b2c8b1f8c8b789');
  });

  it('URI normalizer strips enclosing quotes and accidental duplicate MONGODB_URI= prefixes', () => {
    expect(normalizeMongoUri('mongodb+srv://user:pass@host/sifon')).toBe('mongodb+srv://user:pass@host/sifon');
    expect(normalizeMongoUri('"mongodb+srv://user:pass@host/sifon"')).toBe('mongodb+srv://user:pass@host/sifon');
    expect(normalizeMongoUri("'mongodb+srv://user:pass@host/sifon'")).toBe('mongodb+srv://user:pass@host/sifon');
    expect(normalizeMongoUri('MONGODB_URI=mongodb+srv://user:pass@host/sifon')).toBe('mongodb+srv://user:pass@host/sifon');
    expect(normalizeMongoUri('MONGODB_URI="mongodb+srv://user:pass@host/sifon"')).toBe('mongodb+srv://user:pass@host/sifon');
  });

  it('Placeholder detector flags template tokens and angle brackets without false positives on real passwords', () => {
    // Known placeholders should be rejected
    expect(isPlaceholderUri('mongodb+srv://YOUR_DB_USERNAME:YOUR_URL_ENCODED_PASSWORD@YOUR_ATLAS_CLUSTER_HOST/sifon')).toBe(true);
    expect(isPlaceholderUri('mongodb+srv://<db_username>:<db_password>@cluster0.abcde.mongodb.net/sifon')).toBe(true);
    expect(isPlaceholderUri('mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/sifon')).toBe(true);

    // Real URIs with regular credentials should pass
    expect(isPlaceholderUri('mongodb+srv://sifon_admin:MyP%40ssw0rd123@cluster0.4ox5m7o.mongodb.net/sifon?retryWrites=true&w=majority')).toBe(false);
    expect(isPlaceholderUri('mongodb://127.0.0.1:27017/sifon?replicaSet=rs0')).toBe(false);
  });

  it('Change Email Schema normalizes email and requires current password', () => {
    const valid = changeEmailSchema.parse({
      newEmail: '  NEWADMIN@sifon.LOCAL  ',
      currentPassword: 'secretpassword123',
    });
    expect(valid.newEmail).toBe('newadmin@sifon.local');
    expect(valid.currentPassword).toBe('secretpassword123');

    // Invalid email fails
    expect(() =>
      changeEmailSchema.parse({
        newEmail: 'not-an-email',
        currentPassword: 'secretpassword123',
      })
    ).toThrow();

    // Missing current password fails
    expect(() =>
      changeEmailSchema.parse({
        newEmail: 'valid@sifon.local',
        currentPassword: '',
      })
    ).toThrow();
  });

  it('Change Password Schema enforces 12+ chars, 72-byte max, mismatch checks, and prevents current password reuse', () => {
    // Valid passphrase with spaces
    const valid = changePasswordSchema.parse({
      currentPassword: 'current-secret-password-1',
      newPassword: 'correct horse battery staple passphrase 2026',
      confirmPassword: 'correct horse battery staple passphrase 2026',
    });
    expect(valid.newPassword).toBe('correct horse battery staple passphrase 2026');

    // Too short (< 12 characters) fails
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'current-secret-password-1',
        newPassword: 'shortpass',
        confirmPassword: 'shortpass',
      })
    ).toThrow(/at least 12 characters/);

    // Mismatched confirmation fails
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'current-secret-password-1',
        newPassword: 'new-valid-long-password-123',
        confirmPassword: 'different-password-123',
      })
    ).toThrow(/do not match/);

    // Identical to current password fails
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'same-password-used-again-123',
        newPassword: 'same-password-used-again-123',
        confirmPassword: 'same-password-used-again-123',
      })
    ).toThrow(/cannot be the same/);

    // Exceeding 72 bytes fails
    const over72Bytes = 'A'.repeat(73);
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'current-secret-password-1',
        newPassword: over72Bytes,
        confirmPassword: over72Bytes,
      })
    ).toThrow(/cannot exceed 72 bytes/);
  });

  it('ObjectId Schema and objectIdParamSchema enforce 24-character hexadecimal IDs and reject static tokens', () => {
    // Valid 24-character hex strings pass
    const validId = '507f1f77bcf86cd799439011';
    expect(objectIdSchema.parse(validId)).toBe(validId);
    expect(objectIdParamSchema.parse({ id: validId })).toEqual({ id: validId });

    const validIdUpper = '507F1F77BCF86CD799439011';
    expect(objectIdSchema.parse(validIdUpper)).toBe(validIdUpper);

    // Static route names like 'options' and 'active' are strictly rejected
    expect(() => objectIdParamSchema.parse({ id: 'options' })).toThrow(/Invalid ID format for _id/);
    expect(() => objectIdParamSchema.parse({ id: 'active' })).toThrow(/Invalid ID format for _id/);

    // Non-ObjectId strings are strictly rejected
    expect(() => objectIdParamSchema.parse({ id: 'undefined' })).toThrow(/Invalid ID format for _id/);
    expect(() => objectIdParamSchema.parse({ id: 'null' })).toThrow(/Invalid ID format for _id/);
    expect(() => objectIdParamSchema.parse({ id: '[object Object]' })).toThrow(/Invalid ID format for _id/);
    expect(() => objectIdParamSchema.parse({ id: '123' })).toThrow(/Invalid ID format for _id/);
    expect(() => objectIdParamSchema.parse({ id: '507f1f77bcf86cd79943901z' })).toThrow(/Invalid ID format for _id/);
    expect(() => objectIdParamSchema.parse({ id: '507f1f77bcf86cd79943901' })).toThrow(/Invalid ID format for _id/); // 23 chars
    expect(() => objectIdParamSchema.parse({ id: '507f1f77bcf86cd7994390111' })).toThrow(/Invalid ID format for _id/); // 25 chars
  });

  it('optionalObjectIdQueryParam cleans empty/undefined values and validates valid IDs', () => {
    expect(optionalObjectIdQueryParam.parse(undefined)).toBeUndefined();
    expect(optionalObjectIdQueryParam.parse(null)).toBeUndefined();
    expect(optionalObjectIdQueryParam.parse('')).toBeUndefined();
    expect(optionalObjectIdQueryParam.parse('   ')).toBeUndefined();
    expect(optionalObjectIdQueryParam.parse('undefined')).toBeUndefined();
    expect(optionalObjectIdQueryParam.parse('null')).toBeUndefined();

    const validId = '60d5ec49f1b2c8b1f8c8b456';
    expect(optionalObjectIdQueryParam.parse(validId)).toBe(validId);
    expect(optionalObjectIdQueryParam.parse(`  ${validId}  `)).toBe(validId);

    // Invalid non-empty string throws
    expect(() => optionalObjectIdQueryParam.parse('invalid-id')).toThrow(/Invalid ID format for _id/);
    expect(() => optionalObjectIdQueryParam.parse('[object Object]')).toThrow(/Invalid ID format for _id/);
  });

  it('Brand, Category, and Section creation schemas require non-empty names and trim whitespace', async () => {
    const { createBrandSchema } = await import('../src/modules/brands/brand.validation.js');
    const { createCategorySchema } = await import('../src/modules/categories/category.validation.js');
    const { createSectionSchema } = await import('../src/modules/sections/section.validation.js');

    expect(createBrandSchema.parse({ name: '  Nike  ' })).toEqual({ name: 'Nike' });
    expect(() => createBrandSchema.parse({ name: '' })).toThrow();
    expect(() => createBrandSchema.parse({})).toThrow();

    expect(createCategorySchema.parse({ name: '  Footwear  ' })).toEqual({ name: 'Footwear' });
    expect(() => createCategorySchema.parse({ name: '' })).toThrow();
    expect(() => createCategorySchema.parse({})).toThrow();

    expect(createSectionSchema.parse({ name: '  Ground Floor  ' })).toEqual({ name: 'Ground Floor' });
    expect(() => createSectionSchema.parse({ name: '' })).toThrow();
    expect(() => createSectionSchema.parse({})).toThrow();
  });

  it('Area creation schema requires name and valid sectionId', async () => {
    const { createAreaSchema } = await import('../src/modules/areas/area.validation.js');
    const validSectionId = '507f1f77bcf86cd799439011';

    const validArea = createAreaSchema.parse({
      name: '  Main Store  ',
      sectionId: validSectionId,
    });
    expect(validArea.name).toBe('Main Store');
    expect(validArea.sectionId).toBe(validSectionId);

    // Missing sectionId or invalid sectionId throws
    expect(() => createAreaSchema.parse({ name: 'Main Store' })).toThrow();
    expect(() => createAreaSchema.parse({ name: 'Main Store', sectionId: '123' })).toThrow();
    expect(() => createAreaSchema.parse({ sectionId: validSectionId })).toThrow();
  });

  it('Product creation schema requires brandId and categoryId, but does NOT require code', async () => {
    const { createProductSchema } = await import('../src/modules/products/product.validation.js');
    const brandId = '507f1f77bcf86cd799439011';
    const categoryId = '507f1f77bcf86cd799439022';

    const validProduct = createProductSchema.parse({
      name: 'Running Shoes',
      brandId,
      categoryId,
      unit: 'pairs',
    });
    expect(validProduct.name).toBe('Running Shoes');
    expect(validProduct.brandId).toBe(brandId);
    expect(validProduct.categoryId).toBe(categoryId);
    expect(validProduct.code).toBeUndefined();

    // Missing brandId or categoryId throws
    expect(() =>
      createProductSchema.parse({
        name: 'Running Shoes',
        categoryId,
      })
    ).toThrow();

    expect(() =>
      createProductSchema.parse({
        name: 'Running Shoes',
        brandId,
      })
    ).toThrow();
  });
});

