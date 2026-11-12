import mongoose from 'mongoose';
import { Area, IArea } from './area.model.js';
import { Section } from '../sections/section.model.js';
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
    const trimmedName = input.name.trim();

    // Verify section exists and is valid
    if (!mongoose.Types.ObjectId.isValid(input.sectionId)) {
      throw new ValidationError('Invalid Section ID');
    }
    const section = await Section.findById(input.sectionId);
    if (!section) {
      throw new NotFoundError(`Section not found: ${input.sectionId}`);
    }

    // Check duplicate area name within the same section (case-insensitive)
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Area.findOne({
      sectionId: section._id,
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });
    if (existing) {
      throw new ConflictError(`Area "${trimmedName}" already exists in section "${section.name}"`);
    }

    const area = await Area.create({
      name: trimmedName,
      sectionId: section._id,
      description: input.description?.trim(),
      areaNumber: input.areaNumber,
      isActive: true,
    });

    return await area.populate('sectionId', 'name description');
  }

  static async getAreas(query: AreaQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === true) {
      filter.isActive = { $ne: false };
    } else if (activeFilter === false) {
      filter.isActive = false;
    }

    if (query.sectionId && mongoose.Types.ObjectId.isValid(query.sectionId)) {
      filter.sectionId = new mongoose.Types.ObjectId(query.sectionId);
    }

    if (query.search) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
      ];
      // If search might match a legacy areaNumber
      if (/^\d+$/.test(query.search.trim())) {
        filter.$or.push({ areaNumber: parseInt(query.search.trim(), 10) });
      }
    }

    const total = await Area.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 50;

    const areas = await Area.find(filter)
      .populate('sectionId', 'name description')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const enrichedAreas = areas.map(a => {
      const sectionName = (a.sectionId as any)?.name;
      const areaName = a.name || (a.areaNumber ? `Area ${a.areaNumber}` : 'Unnamed Area');
      const displayName = sectionName ? `${sectionName} — ${areaName}` : areaName;
      return {
        ...a,
        name: areaName,
        displayName,
      };
    });

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
      filter.isActive = { $ne: false };
    }

    if (query.sectionId && mongoose.Types.ObjectId.isValid(query.sectionId)) {
      filter.sectionId = new mongoose.Types.ObjectId(query.sectionId);
    }

    if (query.search) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
      if (/^\d+$/.test(query.search.trim())) {
        filter.$or.push({ areaNumber: parseInt(query.search.trim(), 10) });
      }
    }

    const limit = query.limit || 100;
    const page = query.page || 1;

    let selectedArea: any = null;
    if (query.selectedId && mongoose.Types.ObjectId.isValid(query.selectedId)) {
      selectedArea = await Area.findById(query.selectedId).populate('sectionId', 'name').lean();
    }

    const total = await Area.countDocuments(filter);
    const areas = await Area.find(filter)
      .populate('sectionId', 'name')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let resultList = areas;
    if (selectedArea && !areas.some(a => a._id.toString() === selectedArea._id.toString())) {
      resultList = [selectedArea, ...areas];
    }

    const enrichedAreas = resultList.map(a => {
      const sectionName = (a.sectionId as any)?.name;
      const areaName = a.name || (a.areaNumber ? `Area ${a.areaNumber}` : 'Unnamed Area');
      const displayName = sectionName ? `${sectionName} — ${areaName}` : areaName;
      return {
        _id: a._id,
        name: areaName,
        displayName,
        sectionId: a.sectionId,
        areaNumber: a.areaNumber,
        description: a.description,
        isActive: a.isActive,
      };
    });

    // Natural sort: by section name, then area name
    enrichedAreas.sort((a, b) => a.displayName.localeCompare(b.displayName));

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
    const area = await Area.findById(id).populate('sectionId', 'name description');
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

    // Determine target section
    const targetSectionId = input.sectionId !== undefined ? input.sectionId : area.sectionId;
    const targetName = input.name !== undefined ? input.name.trim() : (area.name || `Area ${area.areaNumber || ''}`);

    if (input.sectionId !== undefined && input.sectionId) {
      if (!mongoose.Types.ObjectId.isValid(input.sectionId)) {
        throw new ValidationError('Invalid Section ID');
      }
      const section = await Section.findById(input.sectionId);
      if (!section) {
        throw new NotFoundError(`Section not found: ${input.sectionId}`);
      }
      area.sectionId = section._id;
    }

    if (input.name !== undefined) {
      // Validate uniqueness within section if sectionId exists
      if (targetSectionId) {
        const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing = await Area.findOne({
          _id: { $ne: area._id },
          sectionId: targetSectionId,
          name: { $regex: new RegExp(`^${escaped}$`, 'i') },
        });
        if (existing) {
          throw new ConflictError(`Another area named "${targetName}" already exists in this section`);
        }
      }
      area.name = targetName;
    }

    // Check if user is attempting to deactivate an area with remaining stock
    if (input.isActive === false && area.isActive === true) {
      const hasStock = await InventoryService.checkAreaHasStock(area._id);
      if (hasStock) {
        const label = area.name || (area.areaNumber ? `Area ${area.areaNumber}` : 'this area');
        throw new BadRequestError(
          `Cannot deactivate ${label} while available or damaged stock remains in it.`
        );
      }
    }

    if (input.description !== undefined) {
      area.description = input.description.trim();
    }
    if (input.isActive !== undefined) {
      area.isActive = input.isActive;
    }

    await area.save();
    return await area.populate('sectionId', 'name description');
  }

  static async deleteArea(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const area = await Area.findById(id);
    if (!area) {
      throw new NotFoundError('Area not found');
    }

    // Check if area was used in inventory history or has stock
    const hasHistory = await InventoryService.checkAreaHasHistory(area._id);
    if (hasHistory) {
      const label = area.name || (area.areaNumber ? `Area ${area.areaNumber}` : 'this area');
      throw new BadRequestError(
        `Cannot delete ${label} because it has historical inventory transactions or active stock. Consider deactivating it instead.`
      );
    }

    await Area.findByIdAndDelete(id);
  }
}
