const O=(n,t,r,ow,sum,x={})=>({id:n,title:t,res:r,owners:ow,summary:sum,status:"todo",progress:0,due:"",done:"",link:"",log:[],subs:[],...x});
export const SEED=[
O("001","Budget 2026-27 approved with conditions","02",["DVCP","DVCAFA"],"Budget approved (income 20,925,896 OMR; opex 18,077,678 OMR; surplus 517,524 OMR) subject to three conditions.",{target:"Next BoD meeting",subs:[
 {t:"Mitigation plan for IMCO and CoE with 5-year enrolment projections presented to BoD",o:"DVCP",d:false},
 {t:"Expenditure-to-income ratio for 2026-27 brought down to 82.15%",o:"DVCAFA",d:false},
 {t:"Hostel revenue and expenditure budgeted at least at break-even",o:"DVCAFA",d:false}]}),
O("002","Monthly allowance for weak students on flexible scholarships (Tamkeen)","04",["Executive Head of Finance","Executive Head of Admission and Registration"],"30 OMR a month, 10 months a year, for the entire study period. Earlier orders ratified and made absolute."),
O("003","Monthly allowance for flexible-scholarship students of all categories","05",["Executive Head of Finance","Executive Head of Admission and Registration"],"30 OMR a month for one year (10 months), regardless of income, as a marketing measure. Ratified and made absolute."),
O("004","Annual payment of 10,000 OMR to each BoD member (2025-26)","06",["DVCAFA"],"Place the BoD recommendation before the next AGM for its resolution.",{target:"Next AGM"}),
O("005","Promotion policy for academic and non-academic staff","07",["Executive Head of HR"],"Incorporate the policy in the HR manual and submit to the BoD with a dedicated budget. No promotions without an approved policy.",{target:"BoD meeting, October 2026"}),
O("006","Ratification of engineering instructions to contractors","08",["Executive Head of Finance"],"Fortune Engineering (Rustaq): 13,180 OMR, 94 days. ADCC (Sultan Haitham City): 28,502 OMR. Mustafa and Kamal Ashraf (Sohar): 16,493 OMR, 65 days."),
O("007","Request of the Dean of CoP for Assistant Dean (Research)","12",["DVCAFA"],"Board resolved to keep to the recently approved organizational structure. Communicate the decision to the Dean of CoP."),
O("008","Signature of the 6-month audit report (M/s Moore)","15",["Executive Head of Finance"],"Dr. Hatim Al Shanfari signs before the report goes to the BoD Chairman for signature."),
O("009","Confirm BoD member attendance one week before meetings","17",["DVCAFA","Company Secretary"],"Confirm attendance at least a week ahead and pass the information to the Chairman.")
].map(o=>({...o,order:"NU/DVCAFA/20261003/"+o.id,res:o.res+"/NUBDM-04-2025-26"}));