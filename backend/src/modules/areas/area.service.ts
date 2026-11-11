import mongoose from 'mongoose';
import { Area, IArea } from './area.model.js';
import {
  CreateAreaInput,
  UpdateAreaInput,
  AreaQueryInput,
  AreaOptionsQueryInput,
} from './area.validation.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';

export class AreaService {
  static async createArea(input: CreateAreaInput): Promise<IArea> {
    const existing = await Area.findOne({ areaNumber: input.areaNumber });
    if (existing) {
      throw new ConflictError(`Area ${input.areaNumber} already exists`);
    }

    const area = await Area.create({
      areaNumber: input.areaNumber,
      description: input.description,
      isActive: true,
    });

    return area;
  }

  static async getAreas(query: AreaQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === true) {
      filter.isActive = { $ne: false };
    } else if (activeFilter === false) {
      filter.isActive = false;
    }

    const total = await Area.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 50;

    // Strict numeric ascending sort by areaNumber (1, 2, 3, 10...)
    const areas = await Area.find(filter)
      .sort({ areaNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const enrichedAreas = areas.map(a => ({
      ...a,
      displayName: `Area ${a.areaNumber}`,
    }));

    return {
      areas: enrichedAreas,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getAreaOptions(query: AreaOptionsQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === false) {
      filter.isActive = false;
    } else {
      // By default for selector dropdowns, return active warehouse areas
      filter.isActive = { $ne: false };
    }

    const limit = query.limit || 100;
    const page = query.page || 1;

    let selectedArea: any = null;
    if (query.selectedId && mongoose.Types.ObjectId.isValid(query.selectedId)) {
      selectedArea = await Area.findById(query.selectedId).lean();
    }

    const total = await Area.countDocuments(filter);

    // Strict numeric ascending sort by areaNumber (1, 2, 3, 10...)
    const areas = await Area.find(filter)
      .sort({ areaNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let resultList = areas;
    if (selectedArea && !areas.some(a => a._id.toString() === selectedArea._id.toString())) {
      resultList = [selectedArea, ...areas].sort((a, b) => a.areaNumber - b.areaNumber);
    }

    const enrichedAreas = resultList.map(a => ({
      _id: a._id,
      areaNumber: a.areaNumber,
      displayName: `Area ${a.areaNumber}`,
      description: a.description,
      isActive: a.isActive,
    }));

    return {
      areas: enrichedAreas,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getAreaById(id: string): Promise<IArea> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const area = await Area.findById(id);
    if (!area) {
      throw new NotFoundError('Area not found');
    }
    return area;
  }

  static async updateArea(id: string, input: UpdateAreaInput): Promise<IArea> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const area = await Area.findById(id);
    if (!area) {
      throw new NotFoundError('Area not found');
    }

    // Check if user is attempting to deactivate an area with remaining stock
    if (input.isActive === false && area.isActive === true) {
      const hasStock = await InventoryService.checkAreaHasStock(area._id);
      if (hasStock) {
        throw new BadRequestError(
          `Cannot deactivate Area ${area.areaNumber} while available or damaged stock remains in it.`
        );
      }
    }

    if (input.description !== undefined) {
      area.description = input.description;
    }
    if (input.isActive !== undefined) {
      area.isActive = input.isActive;
    }

    await area.save();
    return area;
  }

  static async deleteArea(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const area = await Area.findById(id);
    if (!area) {
      throw new NotFoundError('Area not found');
    }

    // Check if area was used in inventory history
    const hasHistory = await InventoryService.checkAreaHasHistory(area._id);
    if (hasHistory) {
      throw new BadRequestError(
        `Cannot delete Area ${area.areaNumber} because it has historical inventory transactions. Consider deactivating it instead.`
      );
    }

    await Area.findByIdAndDelete(id);
  }
}

