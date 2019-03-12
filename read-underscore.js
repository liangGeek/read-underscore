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

    var shallowProperty = function (key) {
        return function (obj) {
            return obj == null ? void 0 : obj[key];
        };
    };

    var has = function (obj, path) {
        return obj != null && hasOwnProperty.call(obj, path);
    }

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
            var keys = _.keys(obj);
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
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

    // object
    _.keys = function (obj) {
        if (!_.isObject(obj)) return [];
        if (nativeKeys) return nativeKeys(obj);
        var keys = [];
        for (var key in obj) if (has(obj, key)) keys.push(key);
        // todo
        return keys;
    }

    // todo why 'function'
    _.isObject = function (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    }

    // dir 方向
    var createReduce = function(dir) {
        var reducer = function(obj, iteratee, memo, initial) {
            var keys = !isArrayLike(obj) && _.keys(obj),
                length = (keys || obj).length,
                index = dir > 0 ? 0 : length - 1;
            // 是否有初始值
            if (!initial) {
                memo = obj[keys ? keys[index] : index]
                index += dir;
            }
            for(; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }
            return memo;
        };

        return function(obj, iteratee, memo, context) {
            var initial = arguments.length >= 3;
            iteratee = optimizedCb(iteratee, context, 4);
            return reducer(obj, iteratee, memo, initial);
        };
    }

    _.reduce = _.reduceLeft = _.foldl = _.inject = createReduce(1);

    _.reduceRight = _.foldr = createReduce(-1);

}())

