import jwt from 'jsonwebtoken';

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

export { protect };