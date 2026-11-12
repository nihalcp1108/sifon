import mongoose from 'mongoose';
import { Section, ISection } from './section.model.js';
import { Area } from '../areas/area.model.js';
import {
  CreateSectionInput,
  UpdateSectionInput,
  SectionQueryInput,
  SectionOptionsQueryInput,
} from './section.validation.js';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';

export class SectionService {
  static async createSection(input: CreateSectionInput): Promise<ISection> {
    const trimmedName = input.name.trim();

    // Check case-insensitive duplicate
    const existing = await Section.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (existing) {
      throw new ConflictError(`Section "${trimmedName}" already exists`);
    }

    const section = await Section.create({
      name: trimmedName,
      description: input.description?.trim(),
      isActive: true,
    });

    return section;
  }

  static async getSections(query: SectionQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === true) {
      filter.isActive = { $ne: false };
    } else if (activeFilter === false) {
      filter.isActive = false;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    const total = await Section.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 50;

    const sections = await Section.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich with area count for each section
    const sectionIds = sections.map(s => s._id);
    const areaCounts = await Area.aggregate([
      { $match: { sectionId: { $in: sectionIds } } },
      { $group: { _id: '$sectionId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>();
    for (const item of areaCounts) {
      countMap.set(item._id.toString(), item.count);
    }

    const enrichedSections = sections.map(s => ({
      ...s,
      areaCount: countMap.get(s._id.toString()) || 0,
    }));

    return {
      sections: enrichedSections,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSectionOptions(query: SectionOptionsQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === false) {
      filter.isActive = false;
    } else {
      filter.isActive = { $ne: false };
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.name = searchRegex;
    }

    const limit = query.limit || 100;
    const page = query.page || 1;

    let selectedSection: any = null;
    if (query.selectedId && mongoose.Types.ObjectId.isValid(query.selectedId)) {
      selectedSection = await Section.findById(query.selectedId).lean();
    }

    const total = await Section.countDocuments(filter);
    const sections = await Section.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let resultList = sections;
    if (selectedSection && !sections.some(s => s._id.toString() === selectedSection._id.toString())) {
      resultList = [selectedSection, ...sections].sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      sections: resultList,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSectionById(id: string): Promise<ISection> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const section = await Section.findById(id);
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    return section;
  }

  static async updateSection(id: string, input: UpdateSectionInput): Promise<ISection> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const section = await Section.findById(id);
    if (!section) {
      throw new NotFoundError('Section not found');
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      const existing = await Section.findOne({
        _id: { $ne: section._id },
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (existing) {
        throw new ConflictError(`Another section with name "${trimmedName}" already exists`);
      }
      section.name = trimmedName;
    }

    if (input.description !== undefined) {
      section.description = input.description.trim();
    }

    if (input.isActive !== undefined) {
      section.isActive = input.isActive;
    }

    await section.save();
    return section;
  }

  static async deleteSection(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const section = await Section.findById(id);
    if (!section) {
      throw new NotFoundError('Section not found');
    }

    // Check if any area is currently in this section
    const areaCount = await Area.countDocuments({ sectionId: section._id });
    if (areaCount > 0) {
      throw new BadRequestError(
        `Cannot delete section "${section.name}" because it still contains ${areaCount} area(s). Please move or delete those areas first.`
      );
    }

    await Section.findByIdAndDelete(id);
  }
}

