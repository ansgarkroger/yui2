YAHOO.util.Get=function(){var I={},H=0,B=0,O=false,A=YAHOO.env.ua,D=YAHOO.lang;var Q=function(U,R,V){var S=V||window,W=S.document,X=W.createElement(U);for(var T in R){if(R[T]&&YAHOO.lang.hasOwnProperty(R,T)){X.setAttribute(T,R[T]);}}return X;};var N=function(R,S){return Q("link",{"id":"yui__dyn_"+(B++),"type":"text/css","rel":"stylesheet","href":R},S);};var M=function(R,S){return Q("script",{"id":"yui__dyn_"+(B++),"type":"text/javascript","src":R},S);};var K=function(R){return{tId:R.tId,win:R.win,data:R.data,nodes:R.nodes,purge:function(){J(this.tId);}};};var P=function(T){var R=I[T];if(R.onFailure){var S=R.scope||R.win;R.onFailure.call(S,K(R));}};var F=function(T){var R=I[T];R.finished=true;if(R.aborted){P(T);return ;}if(R.onSuccess){var S=R.scope||R.win;R.onSuccess.call(S,K(R));}};var E=function(T,W){var S=I[T];if(S.aborted){P(T);return ;}if(W){S.url.shift();if(S.varName){S.varName.shift();}}else{S.url=(D.isString(S.url))?[S.url]:S.url;if(S.varName){S.varName=(D.isString(S.varName))?[S.varName]:S.varName;}}var Z=S.win,Y=Z.document,X=Y.getElementsByTagName("head")[0],U;if(S.url.length===0){if(S.type==="script"&&A.webkit&&A.webkit<420&&!S.finalpass&&!S.varName){var V=M(null,S.win);V.innerHTML='YAHOO.util.Get._finalize("'+T+'");';S.nodes.push(V);X.appendChild(V);}else{F(T);}return ;}var R=S.url[0];if(S.type==="script"){U=M(R,Z);}else{U=N(R,Z);}G(S.type,U,T,R,Z,S.url.length);S.nodes.push(U);X.appendChild(U);if((A.webkit||A.gecko)&&S.type==="css"){E(T,R);}};var C=function(){if(O){return ;}O=true;for(var R in I){var S=I[R];if(S.autopurge&&S.finished){J(S.tId);delete I[R];}}O=false;};var J=function(X){var U=I[X];if(U){var W=U.nodes,R=W.length,V=U.win.document,T=V.getElementsByTagName("head")[0];for(var S=0;S<R;S=S+1){T.removeChild(W[S]);}}U.nodes=[];};var L=function(S,R,T){var V="q"+(H++);T=T||{};if(H%YAHOO.util.Get.PURGE_THRESH===0){C();}I[V]=D.merge(T,{tId:V,type:S,url:R,finished:false,nodes:[]});var U=I[V];U.win=U.win||window;U.scope=U.scope||U.win;U.autopurge=("autopurge" in U)?U.autopurge:(S==="script")?true:false;D.later(0,U,E,V);return{tId:V};};var G=function(a,V,U,S,W,X,Z){var Y=Z||E;if(A.ie){V.onreadystatechange=function(){var b=this.readyState;if("loaded"===b||"complete"===b){Y(U,S);}};}else{if(A.webkit){if(a==="script"){if(A.webkit>=420){V.addEventListener("load",function(){Y(U,S);});}else{var R=I[U];if(R.varName){var T=YAHOO.util.Get.POLL_FREQ;R.maxattempts=YAHOO.util.Get.TIMEOUT/T;R.attempts=0;R._cache=R.varName[0].split(".");R.timer=D.later(T,R,function(f){var d=this._cache,c=d.length,b=this.win,e;for(e=0;e<c;e=e+1){b=b[d[e]];if(!b){this.attempts++;if(this.attempts++>this.maxattempts){R.timer.cancel();P(U);}else{}return ;}}R.timer.cancel();Y(U,S);},null,true);}else{D.later(YAHOO.util.Get.POLL_FREQ,null,Y,[U,S]);}}}}else{V.onload=function(){Y(U,S);};}}};return{POLL_FREQ:10,PURGE_THRESH:20,TIMEOUT:2000,_finalize:function(R){D.later(0,null,F,R);},abort:function(S){var T=(D.isString(S))?S:S.tId;var R=I[T];if(R){R.aborted=true;}},script:function(R,S){return L("script",R,S);},css:function(R,S){return L("css",R,S);}};}();YAHOO.register("get",YAHOO.util.Get,{version:"@VERSION@",build:"@BUILD@"});