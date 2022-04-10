const fs = require('fs')
const path = require('path')



function dateFtt(fmt,date)   
{ //author: meizz   
  var o = {   
    "M+" : date.getMonth()+1,                 //月份   
    "d+" : date.getDate(),                    //日   
    "h+" : date.getHours(),                   //小时   
    "m+" : date.getMinutes(),                 //分   
    "s+" : date.getSeconds(),                 //秒   
    "q+" : Math.floor((date.getMonth()+3)/3), //季度   
    "S"  : date.getMilliseconds()             //毫秒   
  };   
  if(/(y+)/.test(fmt))   
    fmt=fmt.replace(RegExp.$1, (date.getFullYear()+"").substr(4 - RegExp.$1.length));   
  for(var k in o)   
    if(new RegExp("("+ k +")").test(fmt))   
  fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));   
  return fmt;   
} 

function debounce(func,delay){
    let id
    return (...arg)=>{
        if(id){
            clearTimeout(id)
        }
    
        id = setTimeout(()=>{
            func(...arg)
        },delay)
    }
}

function throttor(func,delay){
    let isExcuted=false
    return (...arg)=>{
        if(!isExcuted){
            isExcuted=true
            setTimeout(()=>{
                isExcuted=false
            },delay)
            func(...arg)
        }
    }
}

function rewriteUpdated(event, filename){
    if (event === 'change') {
        const filepath = path.resolve(postsDir,filename)
        const contentArray = fs.readFileSync(filepath).toString().split('\n')
        // let existedUpdated=false
        console.log('234',contentArray.length)
        if(contentArray.length===1){
            console.log(contentArray,filepath)
        }
        for(let index = 0;index<contentArray.length;index++){
            const line = contentArray[index]
            console.log(line)
            if(contentArray[index+1]==='---'){
                break
            }
            if(/updated:.*/.test(line)){
                contentArray[index]=`updated: ${dateFtt('yyyy-MM-dd hh:mm:ss',new Date())}`
                console.log(contentArray[index])
                fs.writeFileSync(filepath,contentArray.join('\n'))
                console.log('done')
                break
            }
        }

    }
}
const debounceRewrite = debounce(throttor(rewriteUpdated,1000),100)
const postsDir = path.resolve('source/_posts')
fs.watch(postsDir, {}, debounceRewrite)
