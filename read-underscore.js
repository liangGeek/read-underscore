(function () {
  // Service Workers和Web Workers 在non-window上下文的环境中
  var root = typeof self == 'object' && self.self === self && self ||
    typeof global == 'object' && global.global === global && global ||
    this ||
    {};

  var ArrayProto = Array.prototype, ObjProto = Object.prototype;

  var push = ArrayProto.push,
    slice = ArrayProto.slice,
    toString = ObjProto.toString,
    hasOwnProperty = ObjProto.hasOwnProperty;

  var nativeIsArray = Array.isArray,
    nativeKeys = Object.keys,
    nativeCreate = Object.create;

  var _ = function (obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }


  // 优化方法，指定上下文
  var optimizedCb = function (func, context, argCount) {
    // void 0 代替 undefined 在ES5之前，window下的undefined是可以被重写的
    // 所以，用void 0是为了防止undefined被重写而出现判断不准确的情况。
    // 非严格模式下，undefined是可以重写的，严格模式则不能重写。
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function (value) {
        return func.call(context, value);
      };
      case 3: return function (value, index, collection) {
        return func.call(context, value, index, collection);
      };
      // creatReduce
      case 4: return function (accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function () {
      return func.apply(context, arguments);
    };
  };

  var builtinIteratee;

  // 生成每个集合的回调函数
  var cb = function (value, context, argCount) {
    // _.iteratee是否被重写
    if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
    // 为空
    if (value == null) return _.identity;
    // 为函数
    if (_.isFunction(value)) return optimizedCb(value, context, argCount);
    // 为非数组对象
    if (_.isObject(value) && !_.isArray()) return _.matcher(value);
    // 数组或者字符串
    return _.property(value);
  }

  _.iteratee = builtinIteratee = function (value, context) {
    return cb(value, context, Infinity);
  }

  var shallowProperty = function (key) {
    return function (obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  var has = function (obj, path) {
    return obj != null && hasOwnProperty.call(obj, path);
  }

  var restArguments = function(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0),
          rest = Array(length),
          index = 0;
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };

  // 属性数组，深层查找
  var deepGet = function (obj, path) {
    var length = path.length;
    for (var i = 0; i < length; i++) {
      if (obj == null) return void 0;
      obj = obj[path[i]];
    }
    return length ? obj : void 0;
  };

  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = shallowProperty('length');
  var isArrayLike = function (collection) {
    var length = getLength(collection);
    return typeof length === 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // collection
  _.each = _.foreach = function (obj, iteratee, context) {
    iteratee = optimizedCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj), key;
      for (i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        iteratee(obj[key], key, obj);
      }
    }
    return obj;
  };

  _.map = _.collect = function (obj, iteratee, context) {
    iteratee = optimizedCb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
      length = (keys || obj).length,
      results = Array(length);
    for (var i = 0; i < length; i++) {
      var currentKey = keys ? keys[i] : i;
      results[i] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  }

  // dir 方向
  var createReduce = function (dir) {
    var reducer = function (obj, iteratee, memo, initial) {
      var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        index = dir > 0 ? 0 : length - 1;
      // 是否有初始值
      if (!initial) {
        memo = obj[keys ? keys[index] : index]
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function (obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      iteratee = optimizedCb(iteratee, context, 4);
      return reducer(obj, iteratee, memo, initial);
    };
  }

  _.reduce = _.reduceLeft = _.foldl = _.inject = createReduce(1);
  _.reduceRight = _.foldr = createReduce(-1);

  _.find = _.detect = function (obj, predicate, context) {
    var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
    var key = keyFinder(obj, predicate, context);
    if (key !== void 0 && key !== -1) return obj[key];
  }

  _.filter = _.select = function (obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function (value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    })
    return results;
  }

  _.reject = function (obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  }

  _.every = _.all = function (obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
      length = (keys || obj).length;
    for (var i = 0; i < length; i++) {
      var key = keys ? obj[keys[i]] : i;
      if (!predicate(obj[key], key, obj)) return false;
    }
    return true;
  }

  _.some = _.any = function (obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
      length = keys.length;
    for (var i = 0; i < length; i++) {
      var key = keys ? keys[i] : i;
      if (predicate(obj[ke], key, obj)) return true;
    }
    return false;
  }

  var createPredicateIndexFinder = function (dir) {
    return function (array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index <= length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    }
  }

  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // 二分法
  _.sortedIndex = function (array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0; high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (array[mid] < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  var createIndexFinder = function (dir, predicateFind, sortedIndex) {
    return function (array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(length, idx + 1) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      // NaN 不和任何数相等, 包括自己
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }

      for (idx = dir > 0 ? i : length - 1; idx < length && idx >= 0; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    }
  }

  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex); // 从后向前找 无顺序

  _.contains = _.includes = _.include = function (obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  }

  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  }

  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  }

  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  _.invoke = restArguments(function(obj, path, args) {
    var contextPath, func;
    if (_.isFunction(path)) {
      func = path;
    } else if (_.isArray(path)) {
      contextPath = path.slice(0, -1);
      path = path[path.length - 1];
    }
    return _.map(obj, function(context) {
      var method = func;
      if (!method) {
        if (contextPath && contextPath.length) {
          context = deepGet(context, contextPath);
        }
        if (context == null) return void 0;
        method = context[path];
      }
      return method == null ? method : method.apply(context, args);
    });
  });

  // object
  _.keys = function (obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (has(obj, key)) keys.push(key);
    // todo
    return keys;
  }

  _.allKeys = function (obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // todo why 'function'
  _.isObject = function (obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  }

  _.isMatch = function (object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    // todo Object 转成对象?
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (obj[key] !== attrs[key] || !(key in obj)) return false;
    }
    return true;
  }

  _.matcher = _.matches = function (attrs) {
    attrs = _.extendOwn({}, attrs);
    return function (obj) {
      return _.isMatch(obj, attrs);
    }
  }

  _.findKey = function (obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), length = keys.length, key;
    for (var i = 0; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  }

  _.values = function (obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  }

  // todo
  var nodelist = root.document && root.document.childNodes;
  if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function (obj) {
      return typeof obj == 'function' || false;
    };
  }


  // 类型判断
  _.each(['Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function (name) {
    _['is' + name] = function (obj) {
      return toString.call(obj) === '[object ' + name + ']';
    }
  });

  _.isNaN = function (obj) {
    return _.isNumber(obj) && isNaN(obj);
  }

  _.property = function (path) {
    if (!_.isArray(path)) {
      return shallowProperty(path);
    }
    return function (obj) {
      return deepGet(obj, path);
    };
  };

  var createAssigner = function (keyFunc, defaults) {
    return function (obj) {
      var length = arguments;
      if (defaults) obj = Object(obj);
      if (length < 2 || obj == null) return obj;
      for (var i = 1; i < length; i++) {
        var source = arguments[i],
          keys = keyFunc(source),
          keysLength = keys.length;
        for (var j = 0; j < keysLength; j++) {
          var key = keys[j];
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
    }
  }

  _.extend = createAssigner(_.allKeys);

  _.extendOwn = _.assign = createAssigner(_.keys);


  // function

  _.negate = function (predicate) {
    return function () {
      return !predicate.apply(this, arguments)
    }
  }


  // Utility
  _.identity = function (value) {
    return value;
  }

}())

