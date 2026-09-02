const Product = require("../models/Product");
const Package = require("../models/Package");
const Order = require("../models/Order");

class ProductService {
  async createProduct(productData) {
    const product = new Product(productData);
    await product.save();
    return product;
  }

  async getProducts(filters = {}) {
    const query = { isActive: true };

    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.isFeatured) {
      query.isFeatured = filters.isFeatured;
    }
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50);

    return products;
  }

  async getProductById(productId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }

  async updateProduct(productId, updateData) {
    const product = await Product.findByIdAndUpdate(
      productId,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true },
    );
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }

  async deleteProduct(productId) {
    const product = await Product.findByIdAndUpdate(
      productId,
      { isActive: false, updatedAt: Date.now() },
      { new: true },
    );
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }

  async createPackage(packageData) {
    if (packageData.products && packageData.products.length > 0) {
      for (const item of packageData.products) {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (!item.name) item.name = product.name;
        if (!item.sku) item.sku = product.sku;
        if (!item.price) item.price = product.ksp || product.mrp;
        if (!item.kbp) item.kbp = product.kbp;
      }
    }

    const newPackage = new Package(packageData);
    await newPackage.save();
    return newPackage;
  }

  async getPackages(filters = {}) {
    const query = { isActive: true };

    if (filters.type) {
      query.type = filters.type;
    }

    const packages = await Package.find(query)
      .populate("products.productId", "name sku kbp mrp ksp")
      .sort({ price: 1 });
    console.log("📦 Service - Packages found:", packages.length);
    return packages;
  }

  async getPackageById(packageId) {
    const packageDoc = await Package.findById(packageId).populate(
      "products.productId",
      "name sku kbp mrp ksp",
    );

    if (!packageDoc) {
      throw new Error("Package not found");
    }
    return packageDoc;
  }

  async updatePackage(packageId, updateData) {
    const packageDoc = await Package.findByIdAndUpdate(
      packageId,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true },
    );
    if (!packageDoc) {
      throw new Error("Package not found");
    }
    return packageDoc;
  }

  async deletePackage(packageId) {
    const packageDoc = await Package.findByIdAndUpdate(
      packageId,
      { isActive: false, updatedAt: Date.now() },
      { new: true },
    );
    if (!packageDoc) {
      throw new Error("Package not found");
    }
    return packageDoc;
  }

  calculateKBP(products) {
    let totalKBP = 0;
    const breakdown = {};

    for (const item of products) {
      const kbp = (item.kbp || 0) * (item.quantity || 1);
      totalKBP += kbp;
      breakdown[item.productId] = kbp;
    }

    return { totalKBP, breakdown };
  }

  async createOrder(userId, packageId, paymentType, deliveryAddress = null) {
    const packageDoc =
      await Package.findById(packageId).populate("products.productId");

    if (!packageDoc) {
      throw new Error("Package not found");
    }

    if (!packageDoc.isActive) {
      throw new Error("Package is not active");
    }

    const products = packageDoc.products.map((item) => ({
      productId: item.productId._id || item.productId,
      name: item.name || item.productId.name,
      sku: item.sku || item.productId.sku,
      quantity: item.quantity || 1,
      price: item.price || item.productId.ksp || item.productId.mrp,
      kbp: item.kbp || item.productId.kbp,
    }));

    const subtotal = products.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const tax = 0;
    const deliveryCharge = 0;
    const totalAmount = subtotal + tax + deliveryCharge;

    const kbpData = this.calculateKBP(products);

    const order = new Order({
      userId: userId,
      packageId: packageDoc._id,
      packageName: packageDoc.name,
      packageType: packageDoc.type,
      products: products,
      subtotal: subtotal,
      tax: tax,
      deliveryCharge: deliveryCharge,
      totalAmount: totalAmount,
      kbpGenerated: kbpData.totalKBP,
      kbpBreakdown: kbpData.breakdown,
      paymentType: paymentType,
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      deliveryAddress: deliveryAddress || null,
      statusHistory: [
        {
          status: "PENDING",
          timestamp: new Date(),
          note: "Order created",
        },
      ],
    });

    await order.save();

    if (paymentType === "OFFLINE") {
      const PaymentConfig = require("../models/PaymentConfig");
      const config = await PaymentConfig.findOne({});

      if (config && config.upi && config.upi.isActive) {
        order.offlinePayment = {
          upiId: config.upi.upiId,
          qrCodeUrl: config.upi.qrCodeUrl,
          paymentDate: null,
          remarks: "",
        };
        await order.save();
      }
    }

    return order;
  }

  async getUserOrders(userId, filters = {}) {
    const query = { userId: userId };

    if (filters.status) {
      query.orderStatus = filters.status;
    }
    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }

    const orders = await Order.find(query)
      .populate("packageId", "name type price")
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .skip(filters.skip || 0);

    const total = await Order.countDocuments(query);

    return {
      orders,
      pagination: {
        total,
        limit: filters.limit || 50,
        skip: filters.skip || 0,
      },
    };
  }

  async getOrderById(orderId, userId = null) {
    const query = { _id: orderId };
    if (userId) {
      query.userId = userId;
    }

    const order = await Order.findOne(query)
      .populate("packageId", "name type price dailyCap weeklyCap monthlyCap")
      .populate("userId", "fullName email phoneNumber")
      .populate("verification.verifiedBy", "fullName email");

    if (!order) {
      throw new Error("Order not found");
    }
    return order;
  }

  async updateOrderStatus(orderId, status, note, updatedBy = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    order.orderStatus = status;
    order.statusHistory.push({
      status: status,
      timestamp: new Date(),
      note: note || `Status updated to ${status}`,
      updatedBy: updatedBy,
    });

    await order.save();
    return order;
  }

  // ============ PROCESS ORDER AFTER PAYMENT ============

  async processOrderAfterPayment(orderId) {
    try {
      const order = await Order.findById(orderId)
        .populate("userId")
        .populate("packageId");

      if (!order) {
        throw new Error("Order not found");
      }

      if (
        order.orderStatus === "PROCESSING" ||
        order.orderStatus === "COMPLETED"
      ) {
        return { success: true, message: "Order already being processed" };
      }

      order.orderStatus = "PROCESSING";
      await order.save();

      // Process income
      const IncomeService = require("./income.service");
      const incomeResult = await IncomeService.processOrderIncome(order);

      // ✅ Award Kuwi Stars for package purchase
      const RankService = require("./rank.service");
      await RankService.addKuwiStars(
        order.userId._id,
        1,
        "PACKAGE_PURCHASE",
        order._id,
        "Order",
        `Package purchase: ${order.packageName}`,
      );

      // ✅ Check and award ranks
      await RankService.checkAndAwardRanks(order.userId._id);

      order.orderStatus = "COMPLETED";
      order.statusHistory.push({
        status: "COMPLETED",
        timestamp: new Date(),
        note: "Order completed and income processed",
      });
      await order.save();

      console.log(`✅ Order ${order.orderNumber} completed successfully`);
      console.log(
        `   Income processed: ${incomeResult.transactions.length} transactions`,
      );

      return {
        success: true,
        message: "Order processed successfully",
        order: order,
        income: incomeResult,
      };
    } catch (error) {
      await Order.findByIdAndUpdate(orderId, {
        orderStatus: "PROCESSING_FAILED",
        statusHistory: {
          $push: {
            status: "PROCESSING_FAILED",
            timestamp: new Date(),
            note: `Failed to process order: ${error.message}`,
          },
        },
      });
      throw new Error(`Failed to process order: ${error.message}`);
    }
  }

  // ============ REPURCHASE METHODS ============

  async createRepurchaseOrder(
    userId,
    productId,
    quantity = 1,
    paymentType = "ONLINE",
    deliveryAddress = null,
  ) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    if (!product.isActive || !product.isInStock) {
      throw new Error("Product is not available");
    }

    if (product.stock < quantity) {
      throw new Error("Insufficient stock");
    }

    const price = product.ksp || product.mrp;
    const subtotal = price * quantity;
    const totalAmount = subtotal;
    const kbp = product.kbp * quantity;

    const order = new Order({
      userId: userId,
      packageId: null,
      packageName: "Repurchase Order",
      packageType: "REPURCHASE",
      products: [
        {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          quantity: quantity,
          price: price,
          kbp: kbp,
        },
      ],
      subtotal: subtotal,
      tax: 0,
      deliveryCharge: 0,
      totalAmount: totalAmount,
      kbpGenerated: kbp,
      kbpBreakdown: { [product._id]: kbp },
      paymentType: paymentType,
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      deliveryAddress: deliveryAddress || null,
      statusHistory: [
        {
          status: "PENDING",
          timestamp: new Date(),
          note: "Repurchase order created",
        },
      ],
    });

    await order.save();

    product.stock -= quantity;
    if (product.stock <= 0) {
      product.isInStock = false;
    }
    await product.save();

    return order;
  }

  async processRepurchaseAfterPayment(orderId) {
    try {
      const order = await Order.findById(orderId).populate("userId");

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.orderStatus === "COMPLETED") {
        return { success: true, message: "Repurchase already processed" };
      }

      order.orderStatus = "PROCESSING";
      await order.save();

      const IncomeService = require("./income.service");
      const incomeResult = await IncomeService.processRepurchaseIncome(
        order.userId._id,
        order.kbpGenerated,
        order._id,
      );

      // ✅ Check and award ranks
      const RankService = require("./rank.service");
      await RankService.checkAndAwardRanks(order.userId._id);

      order.orderStatus = "COMPLETED";
      order.statusHistory.push({
        status: "COMPLETED",
        timestamp: new Date(),
        note: "Repurchase completed and income processed",
      });
      await order.save();

      console.log(`✅ Repurchase ${order.orderNumber} completed successfully`);
      console.log(`   Income transactions: ${incomeResult.length}`);

      return {
        success: true,
        message: "Repurchase processed successfully",
        order: order,
        income: incomeResult,
      };
    } catch (error) {
      await Order.findByIdAndUpdate(orderId, {
        orderStatus: "PROCESSING_FAILED",
        statusHistory: {
          $push: {
            status: "PROCESSING_FAILED",
            timestamp: new Date(),
            note: `Failed to process repurchase: ${error.message}`,
          },
        },
      });
      throw new Error(`Failed to process repurchase: ${error.message}`);
    }
  }
}

module.exports = new ProductService();