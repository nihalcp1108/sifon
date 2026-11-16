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

    // Check duplicate location name across all locations (case-insensitive)
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Area.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });
    if (existing) {
      throw new ConflictError(`Location "${trimmedName}" already exists`);
    }

    let sectionIdToSave: mongoose.Types.ObjectId | undefined = undefined;
    if (input.sectionId && mongoose.Types.ObjectId.isValid(input.sectionId)) {
      const section = await Section.findById(input.sectionId);
      if (section) {
        sectionIdToSave = section._id;
      }
    }

    const area = await Area.create({
      name: trimmedName,
      sectionId: sectionIdToSave,
      description: input.description?.trim(),
      areaNumber: input.areaNumber,
      isActive: true,
    });

    if (sectionIdToSave) {
      return await area.populate('sectionId', 'name description');
    }
    return area;
  }

  static async getAreas(query: AreaQueryInput) {
    const filter: Record<string, any> = {};

    // Filter by isActive only when explicitly requested
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive ? { $ne: false } : false;
    } else if (query.activeOnly === true) {
      filter.isActive = { $ne: false };
    }
    // If activeOnly is false or omitted, and isActive is not specified, include ALL areas (both active and inactive)

    if (query.sectionId) {
      if (query.sectionId === 'unassigned') {
        const validSections = await Section.find({}, '_id').lean();
        const validSectionIds = validSections.map(s => s._id);
        filter.sectionId = { $nin: validSectionIds };
      } else if (mongoose.Types.ObjectId.isValid(query.sectionId)) {
        filter.sectionId = new mongoose.Types.ObjectId(query.sectionId);
      }
    }

    if (query.search) {
      const trimmed = query.search.trim();
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
      ];
      // Support matching legacy areaNumber
      const numMatch = trimmed.match(/\d+/);
      if (numMatch) {
        filter.$or.push({ areaNumber: parseInt(numMatch[0], 10) });
      }
    }

    const total = await Area.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 25;

    const areas = await Area.find(filter)
      .populate('sectionId', 'name description')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const enrichedAreas = areas.map(a => {
      const section = a.sectionId as any;
      const hasValidSection = section && typeof section === 'object' && Boolean(section.name);
      const sectionName = hasValidSection ? section.name : undefined;
      const baseName = a.name || (a.areaNumber ? `Area ${a.areaNumber}` : 'Unnamed Location');
      const displayName = hasValidSection && !baseName.toLowerCase().includes(section.name.toLowerCase())
        ? `${section.name} — ${baseName}`
        : baseName;

      return {
        ...a,
        name: displayName,
        displayName,
        sectionId: hasValidSection ? section : undefined,
        section: hasValidSection ? { _id: section._id, name: section.name } : undefined,
        sectionName,
      };
    });

    return {
      areas: enrichedAreas,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getAreaOptions(query: AreaOptionsQueryInput) {
    const filter: Record<string, any> = {};

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive ? { $ne: false } : false;
    } else if (query.activeOnly !== false) {
      // By default options endpoints filter for active areas unless explicitly requested otherwise
      filter.isActive = { $ne: false };
    }

    if (query.sectionId) {
      if (query.sectionId === 'unassigned') {
        const validSections = await Section.find({}, '_id').lean();
        const validSectionIds = validSections.map(s => s._id);
        filter.sectionId = { $nin: validSectionIds };
      } else if (mongoose.Types.ObjectId.isValid(query.sectionId)) {
        filter.sectionId = new mongoose.Types.ObjectId(query.sectionId);
      }
    }

    if (query.search) {
      const trimmed = query.search.trim();
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
      const numMatch = trimmed.match(/\d+/);
      if (numMatch) {
        filter.$or.push({ areaNumber: parseInt(numMatch[0], 10) });
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
      const section = a.sectionId as any;
      const hasValidSection = section && typeof section === 'object' && Boolean(section.name);
      const sectionName = hasValidSection ? section.name : undefined;
      const baseName = a.name || (a.areaNumber ? `Area ${a.areaNumber}` : 'Unnamed Location');
      const displayName = hasValidSection && !baseName.toLowerCase().includes(section.name.toLowerCase())
        ? `${section.name} — ${baseName}`
        : baseName;

      return {
        _id: a._id,
        name: displayName,
        displayName,
        sectionId: hasValidSection ? section : undefined,
        section: hasValidSection ? { _id: section._id, name: section.name } : undefined,
        sectionName,
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
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getAreaById(id: string): Promise<IArea> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const area = await Area.findById(id).populate('sectionId', 'name description');
    if (!area) {
      throw new NotFoundError('Location not found');
    }
    return area;
  }

  static async updateArea(id: string, input: UpdateAreaInput): Promise<IArea> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const area = await Area.findById(id);
    if (!area) {
      throw new NotFoundError('Location not found');
    }

    if (input.name !== undefined) {
      const targetName = input.name.trim();
      const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await Area.findOne({
        _id: { $ne: area._id },
        name: { $regex: new RegExp(`^${escaped}$`, 'i') },
      });
      if (existing) {
        throw new ConflictError(`Another location named "${targetName}" already exists`);
      }
      area.name = targetName;
    }

    if (input.sectionId !== undefined) {
      if (input.sectionId && mongoose.Types.ObjectId.isValid(input.sectionId)) {
        const section = await Section.findById(input.sectionId);
        if (section) {
          area.sectionId = section._id;
        }
      } else {
        area.sectionId = undefined;
      }
    }

    // Check if user is attempting to deactivate a location with remaining stock
    if (input.isActive === false && area.isActive === true) {
      const hasStock = await InventoryService.checkAreaHasStock(area._id);
      if (hasStock) {
        const label = area.displayName || area.name || 'this location';
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
      throw new NotFoundError('Location not found');
    }

    // Check if location was used in inventory history or has stock
    const hasHistory = await InventoryService.checkAreaHasHistory(area._id);
    const hasStock = await InventoryService.checkAreaHasStock(area._id);
    if (hasHistory || hasStock) {
      const label = (area as any).displayName || area.name || (area.areaNumber ? `Area ${area.areaNumber}` : 'this location');
      throw new BadRequestError(
        `Cannot delete ${label} because it has historical inventory transactions or active stock. Consider deactivating it instead.`
      );
    }

    await Area.findByIdAndDelete(id);
  }
}
