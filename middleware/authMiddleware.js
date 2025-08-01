import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const protect = (req, res, next) => {
    try {
        const token = req.cookies && req.cookies.admin_token;

        if (!token) {
            return res.status(401).json({ message: 'Authorization token missing', tokenValid: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        res.locals.tokenValid = true;
        next();
    } catch (error) {
        console.error('JWT Verification Error:', error.message);
        return res.status(401).json({ message: 'Unauthorized: Invalid or expired token', tokenValid: false });
    }
};

// Enhanced middleware with role checking
const protectWithRole = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            const token = req.cookies && req.cookies.admin_token;

            if (!token) {
                return res.status(401).json({ message: 'Authorization token missing', tokenValid: false });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get admin details from database
            const admin = await Admin.findById(decoded.adminId).select('+authentication.password');
            
            if (!admin || !admin.isActive) {
                return res.status(401).json({ message: 'Admin account not found or inactive', tokenValid: false });
            }

            // Check role permissions
            if (allowedRoles.length > 0 && !allowedRoles.includes(admin.role)) {
                return res.status(403).json({ 
                    message: 'Insufficient permissions for this action',
                    requiredRoles: allowedRoles,
                    userRole: admin.role
                });
            }

            req.user = decoded;
            req.admin = admin;
            res.locals.tokenValid = true;
            next();
        } catch (error) {
            console.error('JWT Verification Error:', error.message);
            return res.status(401).json({ message: 'Unauthorized: Invalid or expired token', tokenValid: false });
        }
    };
};

// Middleware to check specific permissions
const checkPermission = (module, action) => {
    return async (req, res, next) => {
        try {
            if (!req.admin) {
                return res.status(401).json({ message: 'Admin authentication required' });
            }

            const hasPermission = req.admin.hasPermission(module, action);
            
            if (!hasPermission) {
                return res.status(403).json({ 
                    message: `Permission denied: ${action} access required for ${module} module`,
                    required: { module, action },
                    userRole: req.admin.role
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error.message);
            return res.status(500).json({ message: 'Permission verification failed' });
        }
    };
};

// React Native: Checks for token in Authorization header
const protectNative = (req, res, next) => {
    try {
        let token;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Authorization token missing', tokenValid: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        res.locals.tokenValid = true;
        next();
    } catch (error) {
        console.error('JWT Verification Error:', error.message);
        return res.status(401).json({ message: 'Unauthorized: Invalid or expired token', tokenValid: false });
    }
};

// Delivery agent authentication
const protectDelivery = (req, res, next) => {
    try {
        let token;
        
        // Check Authorization header (for React Native)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Delivery agent token missing', tokenValid: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.deliveryAgent = decoded;
        res.locals.tokenValid = true;
        next();
    } catch (error) {
        console.error('Delivery JWT Verification Error:', error.message);
        return res.status(401).json({ message: 'Unauthorized: Invalid delivery token', tokenValid: false });
    }
};

export { protect, protectWithRole, checkPermission, protectNative, protectDelivery };