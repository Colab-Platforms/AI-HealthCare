const SupportTicket = require('../models/SupportTicket');

exports.createTicket = async (req, res) => {
    try{
        const { subject, message, category, attachments } = req.body;
        const userId = req.user._id;

        const ticket = await SupportTicket.create({
            user: userId,
            subject,
            message,
            category,
            attachments,
            status: 'open',
            priority: 'medium'
        });

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getMyTickets = async (req, res) => {
    try {
        const tickets = await SupportTicket.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getAllTickets = async (req, res) => {
    try {
        const { status, category, page = 1, limit = 10 } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (category) query.category = category;

        const tickets = await SupportTicket.find(query)
            .populate('user', 'name email profile.avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await SupportTicket.countDocuments(query);

        res.json({ 
            success: true, 
            tickets, 
            total, 
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.respondToTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { response, status } = req.body;

        const ticket = await SupportTicket.findByIdAndUpdate(
            ticketId,
            {
                adminResponse: response,
                status: status || 'in_progress',
                respondedAt: new Date()
            },
            { new: true }
        );

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getAllTickets = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const tickets = await SupportTicket.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.json({ success: true, tickets, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.respondToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { response, status } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        adminResponse: response,
        status: status || 'in_progress',
        respondedAt: new Date()
      },
      { new: true }
    );

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
