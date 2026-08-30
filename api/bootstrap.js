const phases=[
 {id:1,title:'Physical Foundations'},{id:2,title:'Switching'},{id:3,title:'IP & Services'},{id:4,title:'Network Security'},{id:5,title:'Resilient Networks'},{id:6,title:'Troubleshooting'}
];
module.exports=(req,res)=>{res.setHeader('Cache-Control','public, s-maxage=300');res.status(200).json({product:'CyberLab',version:'8.0-beta',curriculum:{phases,labs:14},architecture:{ui:'modular browser client',simulation:'event-driven network engine',api:'Vercel serverless',persistence:'local beta adapter; production DB adapter planned'}})};
