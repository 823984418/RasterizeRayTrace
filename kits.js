
export function array(length, init) {
    let a = new Array(length);
    for (let i = 0; i < length; i++) {
        a[i] = init(i);
    }
    return a;
}

export function arrayCycleIndex(array, index, from, size) {
    from ??= 0;
    size ??= array.length - from;
    return array[from + (index % size)];
}