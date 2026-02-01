export interface Bookmark {
    id: string;
    position: number;
    label: string;
    createdAt: number;
}

export interface Book {
    id: string;
    title: string;
    author: string;
    text: string;
    createdAt: number;
    bookmarks?: Bookmark[];
}
