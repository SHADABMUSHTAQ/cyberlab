module.exports=(req,res)=>res.status(200).json({ok:true,service:'cyberlab-web',version:'8.0-beta',time:new Date().toISOString()});
