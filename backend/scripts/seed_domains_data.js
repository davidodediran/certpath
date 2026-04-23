/**
 * AWS exam domain definitions — shared data module.
 * Used by both seed_domains.js and the /admin/exam-types/:id/domains/seed endpoint.
 */
module.exports = {

  'clf-c02': [
    { name: 'Cloud Concepts', weight_percent: 24, sort_order: 1,
      keywords: 'cloud concepts,cloud fundamentals,cloud benefits,cloud overview,cloud value proposition,cloud economics,advantages of cloud,cloud models,cloud deployment models,cloud infrastructure,on-premises,hybrid,cloud architecture,benefits of aws' },
    { name: 'Security and Compliance', weight_percent: 30, sort_order: 2,
      keywords: 'security,compliance,iam,shared responsibility,shared responsibility model,identity and access management,data protection,encryption,mfa,multi-factor,root access,principle of least privilege,permissions,policy,kms,key management,waf,shield,guardduty,security hub,inspector,macie,artifact,audit,regulations' },
    { name: 'Cloud Technology and Services', weight_percent: 34, sort_order: 3,
      keywords: 'technology,services,compute,storage,networking,database,ec2,s3,vpc,lambda,rds,dynamodb,cloudfront,route 53,cloudwatch,sns,sqs,ecs,eks,elastic beanstalk,elb,auto scaling,glacier,ebs,efs,serverless,managed services,api gateway,deployment,application,cloud services,aws services' },
    { name: 'Billing, Pricing, and Support', weight_percent: 12, sort_order: 4,
      keywords: 'billing,pricing,support,cost,free tier,cost calculator,cost explorer,budgets,reserved instances,savings plans,spot instances,on-demand,organizations,consolidated billing,aws support,basic support,developer support,business support,enterprise support,total cost of ownership,tco,roi,pricing models' },
  ],

  'saa-c03': [
    { name: 'Design Secure Architectures', weight_percent: 30, sort_order: 1,
      keywords: 'secure architecture,security,iam,encryption,network security,secure access,kms,secrets manager,cognito,security groups,nacl,waf,shield,resource policies,permissions boundaries' },
    { name: 'Design Resilient Architectures', weight_percent: 26, sort_order: 2,
      keywords: 'resilient,resilience,high availability,fault tolerant,disaster recovery,multi-az,multi-region,failover,rto,rpo,backup,replication,elb,auto scaling,route 53 failover' },
    { name: 'Design High-Performing Architectures', weight_percent: 24, sort_order: 3,
      keywords: 'high performance,performance,caching,elasticache,cloudfront,read replicas,database optimization,s3 transfer acceleration,global accelerator,storage performance,compute performance' },
    { name: 'Design Cost-Optimized Architectures', weight_percent: 20, sort_order: 4,
      keywords: 'cost optimized,cost optimization,cost efficient,savings plans,reserved,spot,rightsizing,serverless cost,s3 storage classes,intelligent tiering,data transfer costs' },
  ],

  'dva-c02': [
    { name: 'Development with AWS Services', weight_percent: 32, sort_order: 1,
      keywords: 'development,sdk,api,lambda,dynamodb,sqs,sns,api gateway,kinesis,s3,elastic beanstalk,sam,serverless application model,aws sdk,boto3,cli' },
    { name: 'Security', weight_percent: 26, sort_order: 2,
      keywords: 'security,cognito,iam,encryption,secrets manager,parameter store,kms,ssl,tls,authentication,authorization,token' },
    { name: 'Deployment', weight_percent: 24, sort_order: 3,
      keywords: 'deployment,ci/cd,codepipeline,codedeploy,codebuild,codecommit,cloudformation,sam,blue/green,canary,rolling deployment,infrastructure as code' },
    { name: 'Troubleshooting and Optimization', weight_percent: 18, sort_order: 4,
      keywords: 'troubleshooting,optimization,debugging,monitoring,cloudwatch,x-ray,logs,metrics,alarms,performance tuning,latency,timeout,error handling' },
  ],

  'soa-c02': [
    { name: 'Monitoring, Logging, and Remediation', weight_percent: 20, sort_order: 1,
      keywords: 'monitoring,logging,remediation,cloudwatch,cloudtrail,config,systems manager,alarms,metrics,events,eventbridge,automation,runbook' },
    { name: 'Reliability and Business Continuity', weight_percent: 16, sort_order: 2,
      keywords: 'reliability,business continuity,high availability,disaster recovery,backup,aws backup,rds backup,s3 versioning,multi-az,failover,rto,rpo' },
    { name: 'Deployment, Provisioning, and Automation', weight_percent: 18, sort_order: 3,
      keywords: 'deployment,provisioning,automation,cloudformation,elastic beanstalk,opsworks,systems manager,patch manager,launch templates,ami,infrastructure as code' },
    { name: 'Security and Compliance', weight_percent: 16, sort_order: 4,
      keywords: 'security,compliance,iam,kms,trusted advisor,security hub,guard duty,inspector,config rules,service control policy,scp,permissions' },
    { name: 'Networking and Content Delivery', weight_percent: 18, sort_order: 5,
      keywords: 'networking,content delivery,vpc,subnet,security groups,nacl,cloudfront,route 53,direct connect,vpn,transit gateway,elb,dns' },
    { name: 'Cost and Performance Optimization', weight_percent: 12, sort_order: 6,
      keywords: 'cost,performance,optimization,cost explorer,budgets,trusted advisor,rightsizing,reserved instances,savings plans,spot,auto scaling' },
  ],

  'sap-c02': [
    { name: 'Design Solutions for Organizational Complexity', weight_percent: 26, sort_order: 1,
      keywords: 'organizational complexity,multi-account,aws organizations,control tower,landing zone,scp,governance,compliance,cross-account,federation' },
    { name: 'Design for New Solutions', weight_percent: 29, sort_order: 2,
      keywords: 'new solutions,architecture design,solution design,microservices,serverless,containers,ecs,eks,event-driven,decoupled,well-architected' },
    { name: 'Continuous Improvement for Existing Solutions', weight_percent: 25, sort_order: 3,
      keywords: 'continuous improvement,existing solutions,migration,modernization,optimization,refactoring,performance improvement,cost reduction,operational excellence' },
    { name: 'Accelerate Workload Migration and Modernization', weight_percent: 20, sort_order: 4,
      keywords: 'migration,modernization,cloud migration,database migration,dms,server migration,application migration,migration hub,rehost,replatform,refactor,7r' },
  ],

  'dop-c02': [
    { name: 'SDLC Automation', weight_percent: 22, sort_order: 1,
      keywords: 'sdlc,automation,ci/cd,codepipeline,codebuild,codecommit,codedeploy,testing,continuous integration,continuous delivery,pipeline' },
    { name: 'Configuration Management and IaC', weight_percent: 17, sort_order: 2,
      keywords: 'configuration management,infrastructure as code,iac,cloudformation,cdk,opsworks,chef,puppet,ansible,systems manager,parameter store,ssm' },
    { name: 'Resilient Cloud Solutions', weight_percent: 15, sort_order: 3,
      keywords: 'resilient,resilience,high availability,disaster recovery,multi-az,multi-region,auto scaling,load balancing,fault tolerance' },
    { name: 'Monitoring and Logging', weight_percent: 15, sort_order: 4,
      keywords: 'monitoring,logging,cloudwatch,cloudtrail,x-ray,log analysis,metrics,alarms,dashboards,observability' },
    { name: 'Incident and Event Response', weight_percent: 14, sort_order: 5,
      keywords: 'incident,event response,eventbridge,sns,lambda,systems manager,ops center,runbooks,automation,alerting' },
    { name: 'Security and Compliance', weight_percent: 17, sort_order: 6,
      keywords: 'security,compliance,iam,kms,secrets manager,config,security hub,guard duty,inspector,policy,access control' },
  ],

  'scs-c02': [
    { name: 'Threat Detection and Incident Response', weight_percent: 14, sort_order: 1,
      keywords: 'threat detection,incident response,guardduty,detective,security hub,macie,incident management,forensics,threat intelligence' },
    { name: 'Security Logging and Monitoring', weight_percent: 18, sort_order: 2,
      keywords: 'security logging,monitoring,cloudtrail,cloudwatch,vpc flow logs,access logs,s3 server access,config,log analysis,siem' },
    { name: 'Infrastructure Security', weight_percent: 20, sort_order: 3,
      keywords: 'infrastructure security,network security,vpc,security groups,nacl,waf,shield,ddos,firewall,network firewall,inspector,patch management' },
    { name: 'Identity and Access Management', weight_percent: 16, sort_order: 4,
      keywords: 'identity,access management,iam,sso,cognito,directory service,federation,saml,oauth,role,policy,permissions boundary,resource policy' },
    { name: 'Data Protection', weight_percent: 18, sort_order: 5,
      keywords: 'data protection,encryption,kms,cloudhsm,s3 encryption,rds encryption,macie,data classification,backup,secrets manager,certificate manager' },
    { name: 'Management and Security Governance', weight_percent: 14, sort_order: 6,
      keywords: 'governance,management,organizations,control tower,config rules,audit,compliance,trusted advisor,security posture,risk management' },
  ],

  'mls-c01': [
    { name: 'Data Engineering', weight_percent: 20, sort_order: 1,
      keywords: 'data engineering,etl,glue,kinesis,s3,lake formation,data pipeline,data ingestion,data lake,redshift,data transformation' },
    { name: 'Exploratory Data Analysis', weight_percent: 24, sort_order: 2,
      keywords: 'exploratory data analysis,eda,feature engineering,data preprocessing,data visualization,statistics,pandas,numpy,sagemaker studio,data quality' },
    { name: 'Modeling', weight_percent: 36, sort_order: 3,
      keywords: 'modeling,model training,algorithm,sagemaker,deep learning,neural network,xgboost,linear learner,hyperparameter,tuning,overfitting,underfitting,evaluation,validation' },
    { name: 'Machine Learning Implementation and Operations', weight_percent: 20, sort_order: 4,
      keywords: 'implementation,operations,mlops,deployment,sagemaker endpoint,a/b testing,model monitoring,model registry,pipeline,inference,batch transform' },
  ],

  'ans-c01': [
    { name: 'Network Design', weight_percent: 30, sort_order: 1,
      keywords: 'network design,vpc design,subnet design,transit gateway,vpc peering,direct connect,site-to-site vpn,hybrid connectivity,multi-vpc,ip addressing,cidr' },
    { name: 'Network Implementation', weight_percent: 26, sort_order: 2,
      keywords: 'network implementation,routing,bgp,ospf,route propagation,elb,global accelerator,cloudfront,direct connect configuration,vpn configuration' },
    { name: 'Network Management and Operation', weight_percent: 20, sort_order: 3,
      keywords: 'network management,operations,vpc flow logs,network performance,bandwidth,latency,cloudwatch,reachability analyzer,network access analyzer,troubleshooting' },
    { name: 'Network Security, Compliance, and Governance', weight_percent: 24, sort_order: 4,
      keywords: 'network security,compliance,governance,security groups,nacl,waf,network firewall,shield,firewall manager,dns security,route 53 resolver,private link' },
  ],

  'dbs-c01': [
    { name: 'Workload-Specific Database Design', weight_percent: 26, sort_order: 1,
      keywords: 'database design,workload,rds,aurora,dynamodb,redshift,elasticache,neptune,documentdb,schema design,data modeling,nosql,relational' },
    { name: 'Deployment and Migration', weight_percent: 20, sort_order: 2,
      keywords: 'deployment,migration,dms,database migration,schema conversion,sct,snapshot,restore,blue/green deployment' },
    { name: 'Management and Operations', weight_percent: 18, sort_order: 3,
      keywords: 'management,operations,maintenance,patching,parameter groups,monitoring,performance insights,enhanced monitoring,cloudwatch,backups,snapshots' },
    { name: 'Monitoring and Troubleshooting', weight_percent: 18, sort_order: 4,
      keywords: 'monitoring,troubleshooting,performance insights,slow query,deadlock,wait events,cloudwatch,enhanced monitoring,events,notifications' },
    { name: 'Database Security', weight_percent: 18, sort_order: 5,
      keywords: 'database security,encryption,iam authentication,ssl,tls,vpc,security groups,secrets manager,kms,audit,database activity streams' },
  ],
};
