// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties} from 'react';

type Props = {
    className?: string,
    fill?: string,
    style?: CSSProperties,
}

export default function ActiveCallIcon(props: Props) {
    return (
        <svg
            {...props}
            width='20px'
            height='20px'
            viewBox='0 0 20 20'
            role='img'
        >
            <path d='M13 10C13 9.45602 12.864 8.96002 12.592 8.51202C12.32 8.04802 11.952 7.68002 11.488 7.40802C11.04 7.13602 10.544 7.00002 10 7.00002V5.00802C10.912 5.00802 11.744 5.23202 12.496 5.68002C13.264 6.12802 13.872 6.73602 14.32 7.50402C14.768 8.25602 14.992 9.08802 14.992 10H13ZM17.008 10C17.008 8.73602 16.688 7.56002 16.048 6.47202C15.424 5.41602 14.584 4.57602 13.528 3.95202C12.44 3.31202 11.264 2.99202 10 2.99202V1.00002C11.632 1.00002 13.144 1.40802 14.536 2.22402C15.896 3.02402 16.976 4.09602 17.776 5.44002C18.592 6.84802 19 8.36802 19 10H17.008ZM17.992 13.504C18.264 13.504 18.496 13.6 18.688 13.792C18.896 13.984 19 14.216 19 14.488V17.992C19 18.264 18.896 18.496 18.688 18.688C18.496 18.896 18.264 19 17.992 19C15.688 19 13.48 18.552 11.368 17.656C9.336 16.808 7.536 15.6 5.968 14.032C4.4 12.464 3.192 10.664 2.344 8.63202C1.448 6.52002 1 4.31202 1 2.00802C1 1.73602 1.096 1.50402 1.288 1.31202C1.496 1.10402 1.736 1.00002 2.008 1.00002H5.512C5.784 1.00002 6.016 1.10402 6.208 1.31202C6.4 1.50402 6.496 1.73602 6.496 2.00802C6.496 3.19202 6.688 4.37602 7.072 5.56002C7.136 5.73602 7.144 5.92002 7.096 6.11202C7.048 6.28802 6.96 6.44802 6.832 6.59202L4.624 8.80002C5.344 10.208 6.264 11.48 7.384 12.616C8.52 13.736 9.792 14.656 11.2 15.376L13.408 13.168C13.552 13.04 13.712 12.952 13.888 12.904C14.08 12.856 14.264 12.864 14.44 12.928C15.624 13.312 16.808 13.504 17.992 13.504Z'/>
        </svg>
    );
}
