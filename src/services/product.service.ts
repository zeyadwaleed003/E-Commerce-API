import stringify from 'fast-json-stable-stringify';

import { Product } from '../models/product.model';
import { TQueryString, TResponse } from '../types/api.types';
import { CreateProductBody, UpdateProductBody } from '../types/product.types';
import { UserDocument } from '../types/user.types';
import APIFeatures from '../utils/APIFeatures';
import VariantService from './variant.service';
import RedisService from './redis.service';
import ResponseFormatter from '../utils/responseFormatter';
import CloudinaryService from './cloudinary.service';

class ProductService {
  readonly CACHE_PATTERN = 'products:*';

  async doesProductExist(id: string) {
    const exist = await Product.exists({ _id: id });
    return Boolean(exist);
  }

  async updateRatingStats(
    productId: string,
    { quantity, average }: { quantity: number; average: number }
  ) {
    await Product.findByIdAndUpdate(productId, {
      ratingsQuantity: quantity,
      ratingsAverage: average,
    });

    await RedisService.deleteKeys(this.CACHE_PATTERN);
  }

  async isProductSeller(id: string, user: UserDocument) {
    if (user.role === 'seller') {
      const product = await Product.findById(id).lean();
      if (!product)
        ResponseFormatter.notFound('No document found with that id');

      if (!product.sellerId || !user._id.equals(product.sellerId))
        ResponseFormatter.forbidden(
          'You are not allowed to make actions on this product'
        );
    }
  }

  async createProduct(data: CreateProductBody): Promise<TResponse> {
    const product = await Product.create(data);
    if (!product)
      ResponseFormatter.internalError('Failed to create the document');

    await RedisService.deleteKeys(this.CACHE_PATTERN);

    return {
      status: 'success',
      statusCode: 201,
      data: {
        product,
      },
    };
  }

  async getAllProducts(
    queryString: TQueryString,
    filter = {}
  ): Promise<TResponse> {
    const cacheKey = `products:${stringify(queryString)}:${stringify(filter)}`;
    const cachedResponse = await RedisService.getJSON<TResponse>(cacheKey);

    if (cachedResponse) return cachedResponse;

    const features = new APIFeatures(Product.find(filter), queryString)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const products = await features.query.lean();

    const result = {
      status: 'success',
      statusCode: 200,
      size: products.length,
      data: {
        products,
      },
    };

    await RedisService.setJSON(cacheKey, 3600, result);
    return result;
  }

  async getProductById(id: string): Promise<TResponse> {
    const cacheKey = `products:${id}`;
    const cachedResponse = await RedisService.getJSON<TResponse>(cacheKey);

    if (cachedResponse) return cachedResponse;

    const product = await Product.findById(id).lean();

    if (!product) ResponseFormatter.notFound('No product found with that id');

    const result = {
      status: 'success',
      statusCode: 200,
      data: {
        product,
      },
    };

    await RedisService.setJSON(cacheKey, 1800, result);
    return result;
  }

  async deleteProduct(id: string): Promise<TResponse> {
    await VariantService.deleteVariantsWithNoProduct(id);

    const product = await Product.findByIdAndDelete(id).lean();
    if (!product) ResponseFormatter.notFound('No product found with that id');

    CloudinaryService.deleteMultipleImages(product.imagesPublicIds);

    await RedisService.deleteKeys(this.CACHE_PATTERN);

    return {
      status: 'success',
      statusCode: 204,
      message: 'Document deleted successfully',
    };
  }

  async updateProduct(id: string, data: UpdateProductBody): Promise<TResponse> {
    const product = await Product.findById(id);
    if (!product) ResponseFormatter.notFound('No product found with that id');

    if (data.images)
      CloudinaryService.deleteMultipleImages(product.imagesPublicIds);

    product.set(data);
    const newProduct = await product.save();

    await RedisService.deleteKeys(this.CACHE_PATTERN);

    return {
      status: 'success',
      statusCode: 200,
      data: {
        product: newProduct,
      },
    };
  }

  async removeDeletedCategoriesFromProduct(categoryIds: string[]) {
    await Product.updateMany(
      { categories: { $in: categoryIds } },
      { $pull: { categories: { $in: categoryIds } } }
    );

    await RedisService.deleteKeys(this.CACHE_PATTERN);
  }

  async deleteProductsWithNoCategories() {
    const filter = { categories: { $size: 0 } };
    const products = await Product.find(filter)
      .lean()
      .select('imagesPublicIds');

    await Product.deleteMany(filter);

    const publicIds = products.flatMap((product) => product.imagesPublicIds);
    CloudinaryService.deleteMultipleImages(publicIds);

    await RedisService.deleteKeys(this.CACHE_PATTERN);
  }

  async deleteProductImages(
    id: string,
    imagesToDelete: string[]
  ): Promise<TResponse> {
    const product = await Product.findById(id);
    if (!product) ResponseFormatter.notFound('No product found with that id');

    const remainingIdx: number[] = [];
    const remainingImages = product.images.filter((img, idx) => {
      const keep = !imagesToDelete.includes(img);
      if (keep) remainingIdx.push(idx);

      return keep;
    });
    if (!remainingImages.length)
      ResponseFormatter.badRequest(
        'Cannot delete all images. A product must have at least one image'
      );

    const remainingPublicIds = remainingIdx.map(
      (idx) => product.imagesPublicIds[idx]
    );
    const deletedPublicIds = product.imagesPublicIds.filter(
      (publicId) => !remainingPublicIds.includes(publicId)
    );

    CloudinaryService.deleteMultipleImages(deletedPublicIds);

    product.images = remainingImages;
    product.imagesPublicIds = remainingPublicIds;
    await product.save();

    await RedisService.deleteKeys(this.CACHE_PATTERN);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Images deleted successfully',
      data: {
        product,
      },
    };
  }

  async addImagesToProduct(
    id: string,
    imagesToAdd: string[],
    publicIdsToAdd: string[]
  ): Promise<TResponse> {
    const product = await Product.findById(id);
    if (!product) ResponseFormatter.notFound('No product found with that id');

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        $addToSet: {
          images: { $each: imagesToAdd },
          imagesPublicIds: { $each: publicIdsToAdd },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct)
      ResponseFormatter.internalError('Failed to add images to product');

    await RedisService.deleteKeys(this.CACHE_PATTERN);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Images added successfully',
      data: {
        product: updatedProduct,
      },
    };
  }
}

export default new ProductService();
