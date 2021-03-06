var code, request, response;

$(function() {
  $("#samples").change(function() {
    loadSample(this.value);
  });

  $("#request-sample").change(function() {
    loadRequestSample(this.value);
  });

  code = CodeMirror.fromTextArea(document.getElementById("code"), {
    lineNumbers: true,
    matchBrackets: true,
    mode: "text/typescript"
  });

  code.on("change",function(cm,change) {
    localStorage.setItem('code', code.getValue());
  });


  request = CodeMirror.fromTextArea(document.getElementById("request"), {
    lineNumbers: false,
    matchBrackets: true,
    mode: "text/typescript"
  });

  request.on("change",function(cm,change) {
    localStorage.setItem('request', request.getValue());
  });

  response = CodeMirror.fromTextArea(document.getElementById("response"), {
    lineNumbers: false,
    matchBrackets: true,
    readOnly: true,
    mode: "text/typescript"
  });

  document.onkeyup = function(e) {
    if (e.ctrlKey && e.which == 89) {
      runButton();
    }

    if (e.ctrlKey && e.which == 73) {
      resetEditor();
    }
  };

  if(localStorage.getItem('code') && localStorage.getItem('code').length) {
    code.setValue(localStorage.getItem('code'));
  } else {
    loadSample("check-simple");
  }

  if(localStorage.getItem('request') && localStorage.getItem('request').length) {
    request.setValue(localStorage.getItem('request'));
  }
});

var jsInterpreter;
var console_log_warning = false;

function initAlert(interpreter, scope) {
  var myConsole = interpreter.createObject(interpreter.OBJECT);
  interpreter.setProperty(scope, 'console', myConsole);

  var wrapper = function(text) {
    text = text ? text.toString() : '';

    if(!console_log_warning) {
      console_log_warning = true;
      console.log('%cconsole.log(); is not available in production. Please make sure the debug code is removed before deploying on Crowdin.', 'color: red;');
    }
    // response.replaceRange(text + "\r\n", CodeMirror.Pos(response.lastLine()));

    return interpreter.createPrimitive(console.log(text));
  };

  this.setProperty(myConsole, 'log', this.createNativeFunction(wrapper));

  var crowdinObject = JSON.parse(request.getValue());

  interpreter.setProperty(scope, 'crowdin', interpreter.nativeToPseudo(crowdinObject));
}

function runButton() {
  resetEditor();

  try {
    var crowdinObject = JSON.parse(request.getValue());
    setRequestStatus(true);

    if(!crowdinObject.hasOwnProperty("sourceLanguage")) {
      setRequestStatus(false, "`sourceLanguage` property is required in request");
      return false;
    }

    if(!crowdinObject.hasOwnProperty("targetLanguage")) {
      setRequestStatus(false, "`targetLanguage` property is required in request");
      return false;
    }

    if(!crowdinObject.hasOwnProperty("context")) {
      setRequestStatus(false, "`context` property is required in request");
      return false;
    }

    if(!crowdinObject.hasOwnProperty("contentType")) {
      setRequestStatus(false, "`contentType` property is required in request");
      return false;
    }

    if(!crowdinObject.hasOwnProperty("source")) {
      setRequestStatus(false, "`source` property is required in request");
      return false;
    }

    if(!crowdinObject.hasOwnProperty("translation")) {
      setRequestStatus(false, "`translation` property is required in request");
      return false;
    }
  } catch(e) {
    setRequestStatus(false, "Invalid JSON");
    return false;
  }

  var src = code.getValue();
  
  var start = new Date().getTime();

  if(!src.length) {
    resetEditor();
    return;
  }

  var lambdaFunction = `
  (
      function () {
          var result = (function () { ` + src +  ` })();
          
          if (undefined === result) {
              return undefined;
          }
          
          return JSON.stringify(result);
      }
  )()`;

  try {
    jsInterpreter = new Interpreter(lambdaFunction, initAlert);
    jsInterpreter.REGEXP_MODE = 1;
    jsInterpreter.REGEXP_THREAD_TIMEOUT = 10000;

    jsInterpreter.run();

    var result = JSON.parse(jsInterpreter.value);

    setResponseStatus(result);
  } catch(e) {
    // response.setValue(e.stack);
    response.replaceRange(e.stack, CodeMirror.Pos(response.lastLine()));
  }

  var end = new Date().getTime();

  var time = (end - start);

  $("#time").text("Execution time: " + time + " ms.");
}

function resetEditor() {
  response.setValue("");
  $("#time").text("");
  $("#response-status").html("");
  $("#request-status").html("");
}

function setResponseStatus(responseContent) {
  response.setValue(JSON.stringify(responseContent, null, 4));

  if(responseContent.hasOwnProperty("success")) {
    if(responseContent.success == true) {
      $("#response-status").html("✔️");
    } else {
      if(!responseContent.hasOwnProperty("message")) {
        $("#response-status").html("⚠️ `message` property is required in response");
        return;
      }

      if(!responseContent.hasOwnProperty("fixes")) {
        $("#response-status").html("⚠️ `fixes` property is required in response");          
        return;
      }

      $("#response-status").html("✔️");
    }
    
  } else {
    $("#response-status").html("⚠️ `success` property is required in response");
  }
}

function setRequestStatus(status, errorMessage) {
  if(status) {
      $("#request-status").html("✔️");
  } else {
      $("#request-status").html("⚠️ " + errorMessage);
  }
}

function copyToClipboard() {
  navigator.clipboard.writeText(code.getValue());
}

function loadSample(id) {
  if(code.getValue().length) {
    if(!confirm("This will replace your data")) {
      return;
    }
  }

  code.setValue(codeSamples[id].code);
  loadRequestSample('plain');
  
  resetEditor();
}

function loadRequestSample(id) {
  request.setValue(requestSamples[id].code);
  
  resetEditor();
}

var codeSamples = {
  "check-simple": {
    code: `var result = {success: false};

source = crowdin.source.replace(/(?:\\r\\n|\\r)/g, '\\n');
translation = crowdin.translation.replace(/(?:\\r\\n|\\r)/g, '\\n');
sourceMatch = source.match(/^[ ]+/g);
translationMatch = translation.match(/^[ ]+/g);

if (null != sourceMatch) {
    sourceMatch = sourceMatch[0];
}

if (null != translationMatch) {
    translationMatch = translationMatch[0];
}

sourceLeadingSpaces = null !== sourceMatch ? sourceMatch.length : 0;
translationLeadingSpaces = null !== translationMatch ? translationMatch.length : 0;

if (sourceLeadingSpaces != translationLeadingSpaces) {
    if (sourceLeadingSpaces == 0) {
        result.message = 'The source text does not begin with a space, please remove ' + translationLeadingSpaces + ' space(s) at the beginning of your translation.';
    } else if (translationLeadingSpaces == 0) {
        result.message = 'The source text begins with ' + sourceLeadingSpaces + ' space(s), please add ' + sourceLeadingSpaces + ' space(s) at the beginning of your translation.';
    } else {
        result.message = 'The source text begins with ' + sourceLeadingSpaces + ' space(s), please use the same amount of spaces at the beginning of your translation.';
    }
    if (sourceLeadingSpaces > translationLeadingSpaces) {
        result.fixes = [{
            from_pos: 0,
            to_pos: 0,
            replacement: sourceMatch.slice(0, sourceLeadingSpaces - translationLeadingSpaces)
        }];
    } else {
        result.fixes = [{from_pos: 0, to_pos: translationLeadingSpaces - sourceLeadingSpaces, replacement: ''}];
    }
} else {
    result.success = true;
}

return result;`
  },

  "empty": {
    code: ``,
    request: ``
  }
}

var requestSamples = {
  "plural": {
    code: `{
  "sourceLanguage": "en",
  "targetLanguage": "uk",
  "context": {
    "maxLength": 10,
    "pluralForm": "one"
  },
  "contentType": "application/vnd.crowdin.text+plural",
  "source": "{\\"one\\":\\"String\\",\\"other\\":\\"Strings\\"}",
  "translation": "Рядок"
}`},
"plain": {
  code: `{
  "sourceLanguage": "en",
  "targetLanguage": "uk",
  "context": {
    "maxLength": 10
  },
  "contentType": "text/plain",
  "source": "Strings",
  "translation": "Рядки"
}`},
  "icu": {
    code: `{
  "sourceLanguage": "en",
  "targetLanguage": "uk",
  "context": {},
  "contentType": "application/vnd.crowdin.text+icu",
  "source": "{count, plural, one {# String} other {# Strings}}",
  "translation": "{count, plural, one {# Рядок} few {# Рядків} many {# Рядків} other {# Рядків}}"
}`}
}
